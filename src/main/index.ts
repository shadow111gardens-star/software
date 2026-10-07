import { validateOverlay } from './companion/validation';
import { registerFlowIPC } from './app-flow/ipc';
import { validateFoundation } from './app-flow/foundation-validation';
import { validateLocalFlow } from './app-flow/validation';
import { LocalAppFlow } from '../services/app/local-app-flow';
import { LocalCatalogService } from '../services/catalog/local-catalog';
import { ElectronTrayAdapter } from '../platform/tray/electron-tray-adapter';
import type { AppPage } from '../shared/types/local-flow';
import { createStateEngine, registerStateIPC } from './state';
import { validateStates } from './state/validation';
import { createCompanion, registerCompanionIPC } from './companion';
import { runLiveCursorCheck } from './cursor/live-check';
import { createCursorTracking, registerCursorIPC } from './cursor';
import { createCharacterManager } from './characters';
import { registerCharacterIPC } from './characters/ipc';
import { app, BrowserWindow, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { createMainWindow } from './windows/main-window';
import { getPlatform } from './platform';
import { LocalSettingsStore } from '../services/storage/settings-store';
import { channels } from '../shared/constants/ipc';
app.setName('Anime Cursor');
const development = !app.isPackaged && process.argv.includes('--development');
const cursorCheck = !app.isPackaged && process.argv.includes('--cursor-check');
const overlayCheck = !app.isPackaged && process.argv.includes('--overlay-check');
const overlaySmoke = !app.isPackaged && process.argv.includes('--overlay-smoke');
const smoke = !app.isPackaged && process.argv.includes('--smoke-test');
const stateSmoke = !app.isPackaged && process.argv.includes('--state-smoke');
const stateCheck = !app.isPackaged && process.argv.includes('--state-check');
const flowPhase = !app.isPackaged ? process.argv.find(value => value.startsWith('--flow-check='))?.split('=')[1] : undefined;
const flowCheck = !!flowPhase;
let flowProfile: string | undefined;
if (flowCheck) {
  const raw = process.argv.find(value => value.startsWith('--flow-profile='))?.slice('--flow-profile='.length);
  if (!raw || !['onboarding', 'onboarding-restart', 'first', 'restart', 'paused', 'store-empty'].includes(flowPhase!)) throw new Error('Invalid flow validation profile');
  flowProfile = resolve(raw);
  if (!flowProfile.startsWith(resolve(tmpdir()) + sep) || !flowProfile.includes('anime-cursor-flow-check-')) throw new Error('Flow checks require an isolated temporary profile');
  app.setPath('userData', flowProfile);
}
const validation = smoke || cursorCheck || overlayCheck || overlaySmoke || stateSmoke || stateCheck || flowCheck;
if (validation && !flowCheck) {
  const supplied = process.argv.find(value => value.startsWith('--validation-profile='))?.slice('--validation-profile='.length);
  const isolated = supplied ? resolve(supplied) : mkdtempSync(join(tmpdir(), 'anime-cursor-validation-'));
  if (!isolated.startsWith(resolve(tmpdir()) + sep) || !isolated.includes('anime-cursor-validation-')) throw new Error('Validation requires a temporary profile');
  app.setPath('userData', isolated);
  if (!supplied) app.on('quit', () => { try { rmSync(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { console.warn('[validation] Temporary profile cleanup deferred.'); } });
}
let mainWindow: BrowserWindow | null = null;
let quitting = false;
let reopenMain: () => void = () => undefined;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (!mainWindow) reopenMain(); if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.show(); mainWindow?.focus(); });
  void app.whenReady().then(async () => {
    if (flowCheck) { session.defaultSession.enableNetworkEmulation({ offline: true }); session.fromPartition('anime-cursor-overlay').enableNetworkEmulation({ offline: true }); }
    const storage = new LocalSettingsStore(join(app.getPath('userData'), 'settings'));
    const characters = await createCharacterManager(storage, flowProfile ? join(flowProfile, 'characters') : undefined);
    const cursorTracking = createCursorTracking();
    const stateEngine = createStateEngine(cursorTracking);
    const companion = createCompanion(characters, cursorTracking, storage, development, stateEngine);
    const catalog = new LocalCatalogService(characters); await catalog.initialize();
    const flow = new LocalAppFlow(characters, companion, storage, catalog, { platform: getPlatform().name, version: app.getVersion() }, development || stateSmoke || stateCheck || flowCheck);
    await flow.initialize(!validation || (flowCheck && flowPhase !== 'first'));
    let quitRequested = false;
    const requestQuit = () => { if (quitRequested) return; quitRequested = true; void flow.prepareQuit().finally(() => { quitting = true; app.quit(); }); };
    const show = (page?: AppPage) => { if (page) flow.navigate(page); if (!mainWindow) reopenMain(); mainWindow?.restore(); mainWindow?.show(); mainWindow?.focus(); };
    const tray = new ElectronTrayAdapter(flow, { show, hide: () => mainWindow?.hide(), quit: requestQuit });
    tray.create();
    app.on('before-quit', event => {
      if (!quitting) { event.preventDefault(); requestQuit(); return; }
      companion.dispose(); cursorTracking.dispose(); tray.dispose(); flow.dispose();
    });
    const trusted = (event: IpcMainInvokeEvent) => { if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Untrusted IPC sender'); return mainWindow; };
    registerCharacterIPC(characters, trusted, () => flow.externalCharacterChanged(), id => flow.activate(id));
    registerCompanionIPC(companion, trusted, requestQuit, flow);
    registerFlowIPC(flow, trusted);
    registerStateIPC(stateEngine, trusted, development || stateSmoke || stateCheck || flowCheck);
    registerCursorIPC(cursorTracking, trusted, development || smoke || cursorCheck || overlayCheck || overlaySmoke);
    ipcMain.handle(channels.info, event => { trusted(event); return { platform: getPlatform().name, version: app.getVersion() }; });
    ipcMain.handle(channels.read, event => { trusted(event); return storage.read(); });
    ipcMain.handle(channels.write, (event, settings: unknown) => { trusted(event); return flow.replaceSettings(settings); });
    ipcMain.handle(channels.minimize, event => trusted(event).minimize());
    ipcMain.handle(channels.maximize, event => { const window = trusted(event); if (window.isMaximized()) window.unmaximize(); else window.maximize(); });
    ipcMain.handle(channels.close, event => trusted(event).close());
    const open = () => {
      const settings = flow.getSnapshot().settings;
      mainWindow = createMainWindow(development, !(settings.onboardingCompleted && settings.startMinimized) || (validation && !flowCheck));
      mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow?.hide(); } });
      mainWindow.on('closed', () => { mainWindow = null; });
      if (flowCheck) { const window = mainWindow; window.once('ready-to-show', () => void validateLocalFlow(window, flow, companion, cursorTracking, stateEngine, tray, flowPhase!)); }
      if (stateSmoke || stateCheck) { const window = mainWindow; window.once('ready-to-show', () => void validateStates(window, companion, stateEngine, cursorTracking, characters, stateCheck)); }
      if (overlayCheck || overlaySmoke) { const window = mainWindow; window.once('ready-to-show', () => void validateOverlay(window, companion, cursorTracking, overlayCheck)); }
      if (cursorCheck) { const window = mainWindow; window.once('ready-to-show', () => runLiveCursorCheck(window, cursorTracking)); }
      if (smoke) { const window = mainWindow; window.once('ready-to-show', () => void validateFoundation(window, flow, companion, cursorTracking, tray)); }
    };
    reopenMain = open;
    open();
    app.on('activate', () => show());
  }).catch(error => { console.error(error); app.exit(1); });
  // Tray/menu bar owns the lifetime; only explicit Quit (or OS shutdown) exits.
  app.on('window-all-closed', () => undefined);
}
