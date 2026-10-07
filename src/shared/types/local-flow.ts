import type { AppInfo, AppSettings } from './app';
import type { CharacterCatalog } from './character';
import type { CompanionSnapshot } from './overlay';
export const APP_PAGES = ['home', 'store', 'settings'] as const;
export type AppPage = (typeof APP_PAGES)[number];
export type CompanionAction = 'pause' | 'resume' | 'hide' | 'show';
export type PreferencePatch = Partial<Pick<AppSettings, 'characterSize' | 'cursorOffset' | 'opacity' | 'smoothing' | 'startCompanionAutomatically' | 'startMinimized'>>;
export type CatalogFilter = 'all' | 'installed' | 'featured' | 'free' | 'premium';
export interface LocalProduct { id: string; characterId: string | null; name: string; description: string; preview: string | null; price: number; currency: 'USD'; isFree: boolean; featured: boolean; platforms: Array<'windows' | 'macos'>; version: string; stateCount: number; installed: boolean; concept: boolean }
export interface LocalFlowSnapshot { settings: AppSettings; companion: CompanionSnapshot; status: 'Active' | 'Paused' | 'Hidden' | 'Starting' | 'Error' | 'Unavailable'; catalog: CharacterCatalog; info: AppInfo; page: AppPage; error: string | null; debugEnabled: boolean }
export interface LocalFlowAPI { getSnapshot(): Promise<LocalFlowSnapshot>; getProducts(): Promise<LocalProduct[]>; navigate(page: AppPage): Promise<LocalFlowSnapshot>; activate(id: string): Promise<LocalFlowSnapshot>; completeOnboarding(): Promise<LocalFlowSnapshot>; skipOnboarding(): Promise<LocalFlowSnapshot>; restartOnboarding(): Promise<LocalFlowSnapshot>; companion(action: CompanionAction): Promise<LocalFlowSnapshot>; preferences(patch: PreferencePatch): Promise<LocalFlowSnapshot>; buy(id: string): Promise<string> }
