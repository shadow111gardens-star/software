import { app, nativeImage, screen, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { performance } from 'node:perf_hooks';
import { CompanionController } from '../../services/companion/companion-controller';
import type { CharacterManager } from '../../services/characters/character-manager';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import type { SettingsStore } from '../../services/storage/settings-store';
import { ElectronOverlayAdapter, registerOverlayRendererIPC } from '../windows/overlay-window';
import { channels } from '../../shared/constants/ipc';
import type { CursorStateEngine } from '../../services/state/cursor-state-engine';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
export function createCompanion(characters: CharacterManager, cursor: CursorTrackingService, storage: SettingsStore, development: boolean, stateEngine: CursorStateEngine): CompanionController {
  registerOverlayRendererIPC();
  const controller = new CompanionController({ characters, cursor, stateEngine, settings: () => storage.read(), dimensions: dataUrl => nativeImage.createFromDataURL(dataUrl).getSize(), display: position => {
    const display = screen.getDisplayNearestPoint(position); return { ...display.workArea, id: String(display.id) };
  }, createOverlay: () => new ElectronOverlayAdapter(development), frames: {
    start: callback => { const timer = setInterval(callback, 16); timer.unref(); return timer; },
    stop: timer => clearInterval(timer as ReturnType<typeof setInterval>), now: () => performance.now(),
  } });
  return controller;
}
export function registerCompanionIPC(controller: CompanionController, trusted: (event: IpcMainInvokeEvent) => unknown, quit: () => void = () => app.quit(), flow?: LocalAppFlow): void {
  ipcMain.handle(channels.companionStart, event => { trusted(event); return flow ? flow.action('resume').then(snapshot => snapshot.companion) : controller.start(); });
  ipcMain.handle(channels.companionStop, event => { trusted(event); return flow ? flow.action('pause').then(snapshot => snapshot.companion) : controller.stop(); });
  ipcMain.handle(channels.companionShow, event => { trusted(event); return flow ? flow.action('show').then(snapshot => snapshot.companion) : controller.show(); });
  ipcMain.handle(channels.companionHide, event => { trusted(event); return flow ? flow.action('hide').then(snapshot => snapshot.companion) : controller.hide(); });
  ipcMain.handle(channels.companionSnapshot, event => { trusted(event); return controller.getSnapshot(); });
  ipcMain.handle(channels.quit, event => { trusted(event); setImmediate(quit); });
}
