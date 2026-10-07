import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
import type { AppPage, CompanionAction, PreferencePatch } from '../../shared/types/local-flow';
import { flowChannels } from '../../shared/constants/ipc';
export function registerFlowIPC(flow: LocalAppFlow, trusted: (event: IpcMainInvokeEvent) => unknown): void {
  ipcMain.handle(flowChannels.snapshot, event => { trusted(event); return flow.getSnapshot(); });
  ipcMain.handle(flowChannels.products, event => { trusted(event); return flow.getProducts(); });
  ipcMain.handle(flowChannels.navigate, (event, page: AppPage) => { trusted(event); return flow.navigate(page); });
  ipcMain.handle(flowChannels.activate, (event, id: unknown) => { trusted(event); if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 128) throw new Error('Invalid character selection'); return flow.activate(id); });
  ipcMain.handle(flowChannels.onboarding, event => { trusted(event); return flow.completeOnboarding(); });
  ipcMain.handle(flowChannels.skipOnboarding, event => { trusted(event); return flow.skipOnboarding(); });
  ipcMain.handle(flowChannels.restartOnboarding, event => { trusted(event); return flow.restartOnboarding(); });
  ipcMain.handle(flowChannels.companion, (event, action: CompanionAction) => { trusted(event); return flow.action(action); });
  ipcMain.handle(flowChannels.preferences, (event, input: PreferencePatch) => { trusted(event); return flow.preferences(input); });
  ipcMain.handle(flowChannels.buy, (event, id: unknown) => { trusted(event); if (typeof id !== 'string') throw new Error('Invalid local product'); return flow.buy(id); });
}
