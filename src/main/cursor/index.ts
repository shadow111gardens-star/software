import { app, ipcMain, powerMonitor, type IpcMainInvokeEvent } from 'electron';
import { WindowsCursorAdapter } from '../../platform/windows/cursor-adapter';
import { MacOSCursorAdapter } from '../../platform/macos/cursor-adapter';
import { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import { channels } from '../../shared/constants/ipc';
export function createCursorTracking(intervalMs = 16): CursorTrackingService {
  const adapter = process.platform === 'win32' ? new WindowsCursorAdapter(intervalMs) : process.platform === 'darwin' ? new MacOSCursorAdapter(intervalMs) : null;
  const service = new CursorTrackingService(adapter);
  service.start();
  let suspended = false;
  let resumeTracking = false;
  const suspend = () => { if (suspended) return; suspended = true; resumeTracking = service.getSnapshot().status === 'active'; service.stop(); };
  const resume = () => { if (!suspended) return; suspended = false; if (resumeTracking) service.start(); };
  powerMonitor.on('suspend', suspend); powerMonitor.on('resume', resume);
  app.once('will-quit', () => { service.dispose(); powerMonitor.removeListener('suspend', suspend); powerMonitor.removeListener('resume', resume); });
  console.info(`[cursor] ${JSON.stringify(service.getSnapshot())}`);
  return service;
}
export function registerCursorIPC(service: CursorTrackingService, trusted: (event: IpcMainInvokeEvent) => unknown, debugEnabled: boolean): void {
  ipcMain.handle(channels.cursorSnapshot, event => { trusted(event); return debugEnabled ? service.getSnapshot() : null; });
  const requireDebug = (event: IpcMainInvokeEvent) => { trusted(event); if (!debugEnabled) throw new Error('Cursor debug controls are disabled'); };
  ipcMain.handle(channels.cursorStart, event => { requireDebug(event); return service.start(); });
  ipcMain.handle(channels.cursorStop, event => { requireDebug(event); return service.stop(); });
}
