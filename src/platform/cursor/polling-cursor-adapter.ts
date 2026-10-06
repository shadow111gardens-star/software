import type { CursorAdapter } from '../types';
import type { CursorPosition, CursorListener } from '../../shared/types/cursor';
export interface CursorScheduler { start(callback: () => void, intervalMs: number): unknown; stop(handle: unknown): void }
const scheduler: CursorScheduler = {
  start: (callback, interval) => { const timer = setInterval(callback, interval); timer.unref(); return timer; },
  stop: handle => clearInterval(handle as ReturnType<typeof setInterval>),
};
export class PollingCursorAdapter implements CursorAdapter {
  private timer: unknown = null;
  private position: CursorPosition | null = null;
  private listeners = new Set<CursorListener>();
  private errors = new Set<(error: Error) => void>();
  constructor(private readonly readPosition: () => CursorPosition, readonly intervalMs = 16, private readonly timers: CursorScheduler = scheduler) {
    if (!Number.isInteger(intervalMs) || intervalMs < 8 || intervalMs > 1000) throw new Error('Cursor interval must be an integer from 8 to 1000 ms');
  }
  start(): void {
    if (this.timer !== null) return;
    this.timer = this.timers.start(() => {
      try { this.sample(); }
      catch (error) {
        try { this.stop(); } catch (stopError) { this.notifyError(stopError); }
        this.notifyError(error);
      }
    }, this.intervalMs);
    try { this.sample(); } catch (error) { this.stop(); throw error; }
  }
  stop(): void {
    if (this.timer === null) return;
    const timer = this.timer;
    this.timers.stop(timer);
    this.timer = null;
  }
  getCurrentPosition(): CursorPosition | null { return this.position ? { ...this.position } : null; }
  subscribe(listener: CursorListener): () => void { this.listeners.add(listener); return () => this.unsubscribe(listener); }
  unsubscribe(listener: CursorListener): void { this.listeners.delete(listener); }
  onError(listener: (error: Error) => void): () => void { this.errors.add(listener); return () => this.errors.delete(listener); }
  private notifyError(error: unknown): void {
    const failure = error instanceof Error ? error : new Error(String(error));
    for (const listener of [...this.errors]) { try { listener(failure); } catch (listenerError) { console.error('[cursor] Error listener failed', listenerError); } }
  }
  private sample(): void {
    const next = this.readPosition();
    if (![next.x, next.y, next.timestamp, next.scaleFactor].every(Number.isFinite) || next.scaleFactor <= 0 || !next.displayId || !['windows-system', 'macos-system'].includes(next.source)) throw new Error('Invalid native cursor sample');
    const previous = this.position;
    this.position = { ...next };
    const changed = !previous || previous.x !== next.x || previous.y !== next.y || previous.displayId !== next.displayId || previous.scaleFactor !== next.scaleFactor;
    if (!changed) return;
    for (const listener of [...this.listeners]) {
      try { listener({ position: { ...next }, changed }); }
      catch (error) { console.error('[cursor] Position listener failed', error); }
    }
  }
}
