import type { CursorState } from '../constants/cursor-states';
export interface OverlayBounds { x: number; y: number; width: number; height: number }
export interface OverlayContent { characterId: string; state: CursorState; dataUrl: string; width: number; height: number; padding: number; opacity: number }
export type OverlayStatus = 'stopped' | 'starting' | 'running' | 'hidden' | 'error';
export interface CompanionSnapshot { status: OverlayStatus; characterId: string | null; state: CursorState; bounds: OverlayBounds | null; visible: boolean; error: string | null }
export interface CompanionAPI { start(): Promise<CompanionSnapshot>; stop(): Promise<CompanionSnapshot>; show(): Promise<CompanionSnapshot>; hide(): Promise<CompanionSnapshot>; getSnapshot(): Promise<CompanionSnapshot>; quit(): Promise<void> }
export interface OverlayRendererAPI { getContent(): Promise<OverlayContent>; ready(): Promise<void>; failed(message: string): Promise<void>; onContent(listener: (content: OverlayContent, revision: number) => void): () => void; applied(revision: number): Promise<void> }
