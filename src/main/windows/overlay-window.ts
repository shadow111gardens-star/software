import { BrowserWindow, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OverlayAdapter } from '../../platform/types';
import type { OverlayContent, OverlayBounds } from '../../shared/types/overlay';
import { channels, stateChannels } from '../../shared/constants/ipc';
import { configureMacOSOverlay } from '../../platform/macos/overlay-behavior';
const overlays = new Map<number, ElectronOverlayAdapter>();
export function registerOverlayRendererIPC(): void {
  const trusted = (event: IpcMainInvokeEvent) => {
    const overlay = overlays.get(event.sender.id);
    if (!overlay || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted overlay sender');
    return overlay;
  };
  ipcMain.handle(channels.overlayContent, event => trusted(event).getContent());
  ipcMain.handle(channels.overlayReady, event => trusted(event).markReady());
  ipcMain.handle(channels.overlayFailed, (event, message: unknown) => trusted(event).reportFailure(typeof message === 'string' ? message.slice(0, 256) : 'Overlay renderer failed'));
  ipcMain.handle(stateChannels.overlayApplied, (event, revision: unknown) => { if (!Number.isSafeInteger(revision)) throw new Error('Invalid revision'); trusted(event).markApplied(revision as number); });
}
export class ElectronOverlayAdapter implements OverlayAdapter {
  readonly window: BrowserWindow;
  private content: OverlayContent | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private failure: (message: string) => void = () => undefined;
  private disposed = false;
  private revision = 0;
  private updates = new Map<number, { resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private readonly development: boolean) {
    const overlaySession = session.fromPartition('anime-cursor-overlay');
    overlaySession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    overlaySession.setPermissionCheckHandler(() => false);
    overlaySession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);
      callback({ cancel: !(url.protocol === 'file:' || url.protocol === 'data:' || (development && ['http:', 'ws:'].includes(url.protocol) && url.hostname === '127.0.0.1' && url.port === '5173')) });
    });
    this.window = new BrowserWindow({ width: 100, height: 100, show: false, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, fullscreenable: false, minimizable: false, maximizable: false, webPreferences: { preload: join(__dirname, 'overlay-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, session: overlaySession, backgroundThrottling: true } });
    this.window.setIgnoreMouseEvents(true);
    this.window.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin') configureMacOSOverlay(this.window);
    overlays.set(this.window.webContents.id, this);
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', event => event.preventDefault());
    this.window.webContents.on('preload-error', (_event, _path, error) => this.reportFailure(`Overlay preload failed: ${error.message}`));
    this.window.webContents.on('render-process-gone', (_event, details) => this.reportFailure(`Overlay renderer lost: ${details.reason}`));
    this.window.webContents.on('did-fail-load', (_event, code, description) => { if (code !== -3) this.reportFailure(`Overlay load failed: ${description}`); });
    const id = this.window.webContents.id;
    this.window.on('closed', () => { overlays.delete(id); if (!this.disposed) this.reportFailure('Overlay unexpectedly closed'); });
  }
  onFailure(listener: (message: string) => void): void { this.failure = listener; }
  getContent(): OverlayContent { if (!this.content) throw new Error('Overlay not initialized'); return { ...this.content }; }
  markReady(): void { this.resolveReady?.(); }
  markApplied(revision: number): void { const pending = this.updates.get(revision); if (pending) { clearTimeout(pending.timer); this.updates.delete(revision); pending.resolve(); } }
  update(content: OverlayContent): Promise<void> {
    if (this.disposed || this.window.isDestroyed()) return Promise.reject(new Error('Overlay disposed'));
    this.content = { ...content }; const revision = ++this.revision;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.updates.delete(revision); reject(new Error('Overlay asset decode timed out')); }, 5000);
      this.updates.set(revision, { resolve, reject, timer });
      this.window.webContents.send(stateChannels.overlayUpdate, content, revision);
    });
  }
  reportFailure(message: string): void { if (this.disposed) return; this.rejectReady?.(new Error(message)); this.failure(message); }
  async load(content: OverlayContent): Promise<void> {
    this.content = { ...content };
    const ready = new Promise<void>((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    const timer = setTimeout(() => this.reportFailure('Overlay renderer readiness timed out'), 10000);
    try {
      const entry = this.development ? 'http://127.0.0.1:5173/overlay/index.html' : pathToFileURL(join(__dirname, '../renderer/overlay/index.html')).href;
      await Promise.all([this.window.loadURL(entry), ready]);
    } finally { clearTimeout(timer); this.resolveReady = null; this.rejectReady = null; }
  }
  setBounds(bounds: OverlayBounds): void { if (!this.window.isDestroyed()) this.window.setBounds(bounds, false); }
  show(): void { if (!this.window.isDestroyed()) this.window.showInactive(); }
  hide(): void { if (!this.window.isDestroyed()) this.window.hide(); }
  dispose(): void {
    this.disposed = true;
    for (const pending of this.updates.values()) { clearTimeout(pending.timer); pending.reject(new Error('Overlay disposed')); } this.updates.clear();
    this.rejectReady?.(new Error('Overlay disposed'));
    if (!this.window.isDestroyed()) { overlays.delete(this.window.webContents.id); this.window.destroy(); }
    this.content = null;
  }
}
