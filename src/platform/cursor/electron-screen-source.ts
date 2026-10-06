import type { CursorPosition, CursorSource } from '../../shared/types/cursor';
export interface DesktopScreen {
  getCursorScreenPoint(): { x: number; y: number };
  getDisplayNearestPoint(point: { x: number; y: number }): { id: number; scaleFactor: number };
}
export function readDesktopCursor(screen: DesktopScreen, source: CursorSource): CursorPosition {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  // Electron already supplies DIPs. Multiplying absolute coordinates by scaleFactor
  // would corrupt mixed-DPI monitor layouts.
  return { ...point, timestamp: Date.now(), displayId: String(display.id), scaleFactor: display.scaleFactor, source };
}
