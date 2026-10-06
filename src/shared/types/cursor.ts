export type CursorSource = 'windows-system' | 'macos-system';
export interface CursorPosition {
  /** Absolute desktop DIPs: primary display top-left is (0,0); x right, y down. */
  x: number;
  y: number;
  timestamp: number;
  displayId: string;
  scaleFactor: number;
  source: CursorSource;
}
export interface CursorUpdate { position: CursorPosition; changed: boolean }
export type CursorTrackingStatus = 'stopped' | 'active' | 'error' | 'unsupported';
export interface CursorSnapshot { status: CursorTrackingStatus; position: CursorPosition | null; error: string | null; intervalMs: number }
export type CursorListener = (update: CursorUpdate) => void;
export interface CursorDebugAPI { getSnapshot(): Promise<CursorSnapshot | null>; start(): Promise<CursorSnapshot>; stop(): Promise<CursorSnapshot> }
