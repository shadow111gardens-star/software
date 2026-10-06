import type { OverlayBounds, OverlayContent } from '../shared/types/overlay';
import type { CursorPosition, CursorListener } from '../shared/types/cursor';
export type { CursorPosition } from '../shared/types/cursor';
export interface CursorAdapter { readonly intervalMs: number; start(): void; stop(): void; getCurrentPosition(): CursorPosition | null; subscribe(listener: CursorListener): () => void; unsubscribe(listener: CursorListener): void; onError(listener: (error: Error) => void): () => void }
export interface OverlayAdapter { load(content: OverlayContent): Promise<void>; update(content: OverlayContent): Promise<void>; setBounds(bounds: OverlayBounds): void; show(): void; hide(): void; dispose(): void; onFailure(listener: (message: string) => void): void }
export interface TrayAdapter { create(): void; refresh(): void; dispose(): void }
export interface StartupAdapter { isEnabled(): boolean; setEnabled(enabled: boolean): void }
export interface PlatformFoundation { name: 'windows' | 'macos' | 'unsupported'; capabilities: { cursorTracking: boolean; overlay: boolean; tray: boolean; startup: false } }
