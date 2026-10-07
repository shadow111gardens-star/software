import type { AppSettings } from '../../shared/types/app';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
export const STORAGE_VERSION = 1 as const;
export interface PersistedAppState { version: typeof STORAGE_VERSION; settings: AppSettings }
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
// Migration boundary: legacy unversioned AppSettings -> v1. Future migrations belong here.
export function migrateAppState(input: unknown): { state: PersistedAppState; repaired: boolean } {
  const root = object(input);
  const source = Object.hasOwn(root, 'version') ? object(root.settings) : root;
  const defaults = structuredClone(defaultSettings);
  const range = (key: string, min: number, max: number, fallback: number) => typeof source[key] === 'number' && Number.isFinite(source[key]) && source[key] >= min && source[key] <= max ? source[key] as number : fallback;
  const bool = (key: string, fallback: boolean) => typeof source[key] === 'boolean' ? source[key] as boolean : fallback;
  const offset = object(source.cursorOffset);
  const axis = (key: string) => typeof offset[key] === 'number' && Number.isFinite(offset[key]) && Math.abs(offset[key] as number) <= 1000 ? offset[key] as number : defaults.cursorOffset[key as 'x' | 'y'];
  const id = source.activeCharacterId;
  const enabled = typeof source.companionEnabled === 'boolean' ? source.companionEnabled : typeof source.companionPaused === 'boolean' ? !source.companionPaused : defaults.companionEnabled;
  const settings = validateSettings({
    ...defaults,
    activeCharacterId: typeof id === 'string' && id.length <= 128 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : null,
    companionEnabled: enabled, companionPaused: !enabled,
    companionVisible: bool('companionVisible', defaults.companionVisible),
    characterSize: range('characterSize', 16, 512, defaults.characterSize),
    cursorOffset: { x: axis('x'), y: axis('y') },
    opacity: range('opacity', 0, 1, defaults.opacity), smoothing: range('smoothing', 0, 1, defaults.smoothing),
    onboardingCompleted: bool('onboardingCompleted', defaults.onboardingCompleted),
    startCompanionAutomatically: bool('startCompanionAutomatically', defaults.startCompanionAutomatically),
    startMinimized: bool('startMinimized', defaults.startMinimized),
  });
  const state: PersistedAppState = { version: STORAGE_VERSION, settings };
  return { state, repaired: JSON.stringify(input) !== JSON.stringify(state) };
}
export function persistedState(settings: AppSettings): PersistedAppState {
  return { version: STORAGE_VERSION, settings: validateSettings(settings) };
}

