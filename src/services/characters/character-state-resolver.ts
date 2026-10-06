import { isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import type { CharacterAsset, CharacterPack } from '../../shared/types/character';
export interface StateCharacters { getActiveCharacter(): CharacterPack | null; getStateAsset(id: string, state: CursorState): Promise<CharacterAsset | null> }
export class CharacterStateResolver {
  private cache = new Map<string, Promise<CharacterAsset | null>>();
  constructor(private readonly characters: StateCharacters) {}
  resolve(state: CursorState): Promise<CharacterAsset | null> {
    state = isCursorState(state) ? state : 'normal';
    const active = this.characters.getActiveCharacter();
    if (!active) return Promise.resolve(null);
    const key = `${active.id}:${active.version}:${state}`;
    const cached = this.cache.get(key); if (cached) return cached;
    // CharacterManager owns validation and requested-state -> normal fallback.
    const pending = this.characters.getStateAsset(active.id, state);
    this.cache.set(key, pending);
    const forget = () => { if (this.cache.get(key) === pending) this.cache.delete(key); };
    void pending.then(asset => { if (!asset || asset.fallback) forget(); }, forget);
    return pending;
  }
  clear(): void { this.cache.clear(); }
}
