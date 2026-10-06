import type { CursorState } from '../constants/cursor-states';
export type CharacterPlatform = 'windows' | 'macos';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface CharacterPack {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  preview?: string;
  platforms: CharacterPlatform[];
  states: Record<CursorState, string>;
  metadata: Record<string, JsonValue>;
}
export interface PackProblem { directory: string; id?: string; errors: string[] }
export interface CharacterCatalog { characters: CharacterPack[]; activeCharacterId: string | null; unavailable: PackProblem[] }
export interface CharacterAsset {
  characterId: string;
  requestedState: CursorState;
  resolvedState: CursorState;
  dataUrl: string;
  fallback: boolean;
}
export interface CharacterAPI {
  getCharacters(): Promise<CharacterCatalog>;
  getCharacter(id: string): Promise<CharacterPack | null>;
  getActiveCharacter(): Promise<CharacterPack | null>;
  hasCharacter(id: string): Promise<boolean>;
  setActiveCharacter(id: string): Promise<CharacterPack>;
  getStateAsset(id: string, state: CursorState): Promise<CharacterAsset | null>;
}
