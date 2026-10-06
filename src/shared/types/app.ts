import type { CompanionAPI } from './overlay';
import type { StateDebugAPI } from './state';
import type { LocalFlowAPI } from './local-flow';
import type { CursorDebugAPI } from './cursor';
import type { CharacterAPI } from './character';
export interface CharacterSettings { characterSize: number; cursorOffset: { x: number; y: number }; opacity: number; smoothing: number }
export interface AppSettings extends CharacterSettings { activeCharacterId: string | null; companionEnabled: boolean; onboardingCompleted: boolean; startCompanionAutomatically: boolean; startMinimized: boolean }
export interface AppInfo { platform: 'windows' | 'macos' | 'unsupported'; version: string }
export interface DesktopAPI { flow: LocalFlowAPI; state: StateDebugAPI; companion: CompanionAPI; cursor: CursorDebugAPI; characters: CharacterAPI; getInfo(): Promise<AppInfo>; getSettings(): Promise<AppSettings>; saveSettings(settings: AppSettings): Promise<AppSettings>; minimize(): Promise<void>; toggleMaximize(): Promise<void>; close(): Promise<void> }
