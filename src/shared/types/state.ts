import type { CursorState } from '../constants/cursor-states';
import type { CursorPosition, CursorTrackingStatus } from './cursor';
export interface SemanticCursorSample { state: CursorState | null; reliable: boolean; source: string; timestamp: number; error: string | null }
export interface CursorContext {
  position: CursorPosition | null; previousPosition: CursorPosition | null;
  movement: { dx: number; dy: number; distance: number; speed: number };
  trackingStatus: CursorTrackingStatus; semantic: SemanticCursorSample; timestamp: number;
}
export interface StateSnapshot { state: CursorState; source: string; override: CursorState | null; context: CursorContext | null }
export interface StateDebugAPI { getSnapshot(): Promise<StateSnapshot | null>; setOverride(state: CursorState | null): Promise<StateSnapshot> }
export interface SemanticCursorAdapter { start(): void; stop(): void; getSample(): SemanticCursorSample }
