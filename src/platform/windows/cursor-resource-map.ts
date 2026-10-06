import type { CursorState } from '../../shared/constants/cursor-states';
// Win32 resource identifiers, not a second list of engine states. Extra has no unambiguous Win32 mapping.
export const WINDOWS_CURSOR_RESOURCES: Readonly<Record<number, CursorState>> = {
  32512: 'normal', 32513: 'text', 32514: 'busy', 32515: 'precision', 32516: 'alternate',
  32631: 'handwriting', 32642: 'diagonal', 32643: 'diagonalSecondary', 32644: 'horizontal',
  32645: 'vertical', 32646: 'move', 32648: 'unavailable', 32649: 'link', 32650: 'working', 32651: 'help',
};
export function resourceState(id: unknown): CursorState | null { return typeof id === 'number' ? WINDOWS_CURSOR_RESOURCES[id] ?? null : null; }
