import type { CursorPosition } from '../../shared/types/cursor';
import type { OverlayBounds } from '../../shared/types/overlay';
export interface DesktopArea extends OverlayBounds { id: string }
export const OVERLAY_PADDING = 2;
export function characterDimensions(image: { width: number; height: number }, size: number, area: DesktopArea): { width: number; height: number } {
  if (![image.width, image.height, size, area.width, area.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid overlay dimensions');
  const scale = Math.min(size / Math.max(image.width, image.height), (area.width - 2 * OVERLAY_PADDING) / image.width, (area.height - 2 * OVERLAY_PADDING) / image.height);
  if (scale <= 0) throw new Error('Display area too small for companion');
  return { width: Math.max(1, Math.floor(image.width * scale)), height: Math.max(1, Math.floor(image.height * scale)) };
}
export function clampBounds(bounds: OverlayBounds, area: DesktopArea): OverlayBounds {
  return { ...bounds, x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width))), y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height))) };
}
export function cursorOverlayBounds(cursor: CursorPosition, offset: { x: number; y: number }, size: { width: number; height: number }, area: DesktopArea): OverlayBounds {
  const width = size.width + 2 * OVERLAY_PADDING;
  const height = size.height + 2 * OVERLAY_PADDING;
  let x = cursor.x + offset.x;
  let y = cursor.y + offset.y;
  if (x + width > area.x + area.width) x = cursor.x - Math.abs(offset.x) - width;
  if (y + height > area.y + area.height) y = cursor.y - Math.abs(offset.y) - height;
  return clampBounds({ x, y, width, height }, area);
}
export function smoothPoint(current: { x: number; y: number }, target: { x: number; y: number }, elapsedMs: number, smoothing: number): { x: number; y: number } {
  const distance = Math.hypot(target.x - current.x, target.y - current.y);
  if (smoothing <= 0 || distance > 512 || distance < 0.25) return { x: target.x, y: target.y };
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / (Math.min(1, smoothing) * 60));
  return { x: current.x + (target.x - current.x) * alpha, y: current.y + (target.y - current.y) * alpha };
}
