import type { AppSettings } from '../../shared/types/app';
import type { CharacterAsset, CharacterCatalog, CharacterPack, PackProblem } from '../../shared/types/character';
import { isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
import type { SettingsStore } from '../storage/settings-store';
import { readImage, type ImageValidator } from './assets';
import { CharacterPackLoader, type CharacterLogger, type LoadedCharacterPack } from './character-pack-loader';
export class CharacterManager {
  private packs = new Map<string, LoadedCharacterPack>();
  private unavailable: PackProblem[] = [];
  private activeId: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly loader: CharacterPackLoader, private readonly storage: SettingsStore, private readonly validateImage: ImageValidator, private readonly defaultId: string | null = null, private readonly log: CharacterLogger = console.error) {}
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => undefined);
    return task;
  }
  initialize(): Promise<void> {
    return this.serialize(async () => {
      const result = await this.loader.discover();
      this.packs = new Map(result.packs.map(pack => [pack.manifest.id, pack]));
      this.unavailable = result.unavailable;
      let settings: AppSettings;
      let writable = true;
      try { settings = await this.storage.read(); }
      catch (error) { this.log(`[characters] Settings could not be read: ${String(error)}`); settings = structuredClone(defaultSettings); writable = false; }
      this.activeId = this.chooseActive(settings.activeCharacterId);
      if (writable && settings.activeCharacterId !== this.activeId) {
        try { await this.storage.write({ ...settings, activeCharacterId: this.activeId }); }
        catch (error) { this.log(`[characters] Active selection could not be persisted: ${String(error)}`); }
      }
    });
  }
  private chooseActive(id: string | null): string | null {
    if (id && this.packs.has(id)) return id;
    if (this.defaultId && this.packs.has(this.defaultId)) return this.defaultId;
    return [...this.packs.keys()].sort()[0] ?? null;
  }
  getCharacters(): CharacterPack[] { return [...this.packs.values()].map(pack => structuredClone(pack.manifest)); }
  getCharacter(id: string): CharacterPack | null { const pack = this.packs.get(id); return pack ? structuredClone(pack.manifest) : null; }
  hasCharacter(id: string): boolean { return this.packs.has(id); }
  getActiveCharacter(): CharacterPack | null { return this.activeId ? this.getCharacter(this.activeId) : null; }
  getCatalog(): CharacterCatalog { return { characters: this.getCharacters(), activeCharacterId: this.activeId, unavailable: structuredClone(this.unavailable) }; }
  setActiveCharacter(id: string): Promise<CharacterPack> {
    return this.serialize(async () => {
      const character = this.getCharacter(id);
      if (!character) throw new Error(`Character unavailable: ${id}`);
      const settings = await this.storage.read();
      await this.storage.write({ ...settings, activeCharacterId: id });
      this.activeId = id;
      return character;
    });
  }
  saveSettings(input: unknown): Promise<AppSettings> {
    const settings = validateSettings(input);
    return this.serialize(async () => {
      if (settings.activeCharacterId === null && this.packs.size > 0) throw new Error('Select an available active character');
      if (settings.activeCharacterId !== null && !this.hasCharacter(settings.activeCharacterId)) throw new Error('Selected character is unavailable');
      const saved = await this.storage.write(settings);
      this.activeId = saved.activeCharacterId;
      return saved;
    });
  }
  async getStateAsset(characterId: string, state: CursorState): Promise<CharacterAsset | null> {
    if (!isCursorState(state)) throw new Error('Unknown cursor state');
    const pack = this.packs.get(characterId);
    if (!pack) { this.log(`[characters] Character unavailable: ${characterId}`); return null; }
    const resolve = async (resolvedState: CursorState): Promise<CharacterAsset> => {
      const image = await readImage(pack.directory, pack.manifest.states[resolvedState], this.validateImage);
      return { characterId, requestedState: state, resolvedState, dataUrl: image.dataUrl, fallback: resolvedState !== state };
    };
    try { return await resolve(state); }
    catch (error) { this.log(`[characters] ${characterId}/${state}: ${String(error)}`); }
    if (state !== 'normal') {
      try { return await resolve('normal'); }
      catch (error) { this.log(`[characters] ${characterId}/normal fallback failed: ${String(error)}`); }
    }
    return null;
  }
}
