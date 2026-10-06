import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { CursorStateEngine } from '../../services/state/cursor-state-engine';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import { WindowsSemanticCursorAdapter } from '../../platform/windows/semantic-cursor-adapter';
import { MacOSSemanticCursorAdapter } from '../../platform/macos/semantic-cursor-adapter';
import { stateChannels } from '../../shared/constants/ipc';
import { isCursorState } from '../../shared/constants/cursor-states';
export function createStateEngine(cursor: CursorTrackingService): CursorStateEngine {
  return new CursorStateEngine(cursor, process.platform === 'win32' ? new WindowsSemanticCursorAdapter() : new MacOSSemanticCursorAdapter());
}
export function registerStateIPC(engine: CursorStateEngine, trusted: (event: IpcMainInvokeEvent) => unknown, debugEnabled: boolean): void {
  ipcMain.handle(stateChannels.snapshot, event => { trusted(event); return debugEnabled ? engine.manager.getSnapshot() : null; });
  ipcMain.handle(stateChannels.override, (event, input: unknown) => {
    trusted(event); if (!debugEnabled) throw new Error('Development state override is disabled');
    if (input !== null && !isCursorState(input)) throw new Error('Invalid cursor state');
    return engine.manager.setOverride(input);
  });
}
