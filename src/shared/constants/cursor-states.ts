export const CURSOR_STATES = [
  'normal', 'help', 'working', 'busy', 'precision', 'text', 'handwriting',
  'unavailable', 'move', 'horizontal', 'diagonal', 'alternate', 'vertical',
  'diagonalSecondary', 'link', 'extra',
] as const;
export type CursorState = (typeof CURSOR_STATES)[number];
export function isCursorState(value: unknown): value is CursorState {
  return typeof value === 'string' && (CURSOR_STATES as readonly string[]).includes(value);
}
