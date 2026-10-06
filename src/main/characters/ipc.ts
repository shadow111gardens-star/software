import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { CharacterManager } from '../../services/characters/character-manager';
import { channels } from '../../shared/constants/ipc';
import { isCursorState } from '../../shared/constants/cursor-states';
export function registerCharacterIPC(manager: CharacterManager, trusted: (event: IpcMainInvokeEvent) => unknown, changed: () => Promise<unknown> = async () => undefined, activate?: (id: string) => Promise<unknown>): void {
  const id = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > 128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error('Invalid character id');
    return value;
  };
  ipcMain.handle(channels.characters, event => { trusted(event); return manager.getCatalog(); });
  ipcMain.handle(channels.character, (event, value: unknown) => { trusted(event); return manager.getCharacter(id(value)); });
  ipcMain.handle(channels.activeCharacter, event => { trusted(event); return manager.getActiveCharacter(); });
  ipcMain.handle(channels.hasCharacter, (event, value: unknown) => { trusted(event); return manager.hasCharacter(id(value)); });
  ipcMain.handle(channels.activateCharacter, async (event, value: unknown) => { trusted(event); const selected = id(value); if (activate) { await activate(selected); return manager.getCharacter(selected); } const character = await manager.setActiveCharacter(selected); await changed(); return character; });
  ipcMain.handle(channels.stateAsset, (event, value: unknown, state: unknown) => {
    trusted(event);
    if (!isCursorState(state)) throw new Error('Unknown cursor state');
    return manager.getStateAsset(id(value), state);
  });
}
