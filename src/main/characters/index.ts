import { app, nativeImage } from 'electron';
import { join } from 'node:path';
import { CharacterPackLoader } from '../../services/characters/character-pack-loader';
import { CharacterManager } from '../../services/characters/character-manager';
import type { SettingsStore } from '../../services/storage/settings-store';
import { getPlatform } from '../platform';
export async function createCharacterManager(storage: SettingsStore, root = join(__dirname, '../assets/characters')): Promise<CharacterManager> {
  const validateImage = (bytes: Buffer) => !nativeImage.createFromBuffer(bytes).isEmpty();
  const loader = new CharacterPackLoader(root, getPlatform().name, validateImage);
  const manager = new CharacterManager(loader, storage, validateImage, 'aiko');
  await manager.initialize();
  const catalog = manager.getCatalog();
  console.info(`[characters] ${catalog.characters.length} valid packs, ${catalog.unavailable.length} unavailable; active=${catalog.activeCharacterId ?? 'none'} (${app.getName()})`);
  return manager;
}
