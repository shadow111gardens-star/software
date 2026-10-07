import type { AppSettings } from '../types/app';
export const defaultSettings: AppSettings = { activeCharacterId: null, companionEnabled: false, companionVisible: true, companionPaused: true, characterSize: 96, cursorOffset: { x: 20, y: 20 }, opacity: 1, smoothing: 0.5, onboardingCompleted: false, startCompanionAutomatically: true, startMinimized: false };
export function validateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') throw new Error('Invalid settings');
  const s = value as AppSettings;
  const range = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!(s.activeCharacterId === null || (typeof s.activeCharacterId === 'string' && s.activeCharacterId.length <= 128)) || typeof s.companionEnabled !== 'boolean' || !range(s.characterSize, 16, 512) || !range(s.opacity, 0, 1) || !range(s.smoothing, 0, 1) || !s.cursorOffset || !range(s.cursorOffset.x, -1000, 1000) || !range(s.cursorOffset.y, -1000, 1000)) throw new Error('Invalid settings');
  const boolean = (key: 'onboardingCompleted' | 'startCompanionAutomatically' | 'startMinimized' | 'companionVisible') => {
    const value = s[key]; if (value === undefined) return defaultSettings[key];
    if (typeof value !== 'boolean') throw new Error('Invalid settings'); return value;
  };
  if (s.companionPaused !== undefined && typeof s.companionPaused !== 'boolean') throw new Error('Invalid settings');
  return { activeCharacterId: s.activeCharacterId, companionEnabled: s.companionEnabled, companionVisible: boolean('companionVisible'), companionPaused: !s.companionEnabled, characterSize: s.characterSize, cursorOffset: { x: s.cursorOffset.x, y: s.cursorOffset.y }, opacity: s.opacity, smoothing: s.smoothing, onboardingCompleted: boolean('onboardingCompleted'), startCompanionAutomatically: boolean('startCompanionAutomatically'), startMinimized: boolean('startMinimized') };
}
