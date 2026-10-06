import type { CursorTrackingService } from '../cursor/cursor-tracking-service';
import type { CursorPosition } from '../../shared/types/cursor';
import type { SemanticCursorAdapter } from '../../shared/types/state';
import { StateManager } from '../../engine/state/state-manager';
export class CursorStateEngine {
  readonly manager = new StateManager();
  private running = false;
  private sampling = false;
  private removeStatus: (() => void) | null = null;
  private previous: CursorPosition | null = null;
  constructor(private readonly cursor: CursorTrackingService, private readonly adapter: SemanticCursorAdapter, private readonly now = () => Date.now()) {}
  start(): void { if (this.running) return; this.running = true; this.removeStatus = this.cursor.subscribeStatus(() => this.tick()); this.tick(); }
  tick(): void {
    if (!this.running) return;
    const cursor = this.cursor.getSnapshot(); const position = cursor.position;
    if (cursor.status === 'active' && !this.sampling) { this.adapter.start(); this.sampling = true; }
    else if (cursor.status !== 'active' && this.sampling) { this.adapter.stop(); this.sampling = false; }
    const previous = this.previous;
    const dx = position && previous ? position.x - previous.x : 0;
    const dy = position && previous ? position.y - previous.y : 0;
    const elapsed = position && previous ? position.timestamp - previous.timestamp : 0;
    const distance = Math.hypot(dx, dy);
    this.manager.update({ position, previousPosition: previous, movement: { dx, dy, distance, speed: elapsed > 0 ? distance * 1000 / elapsed : 0 }, trackingStatus: cursor.status, semantic: this.adapter.getSample(), timestamp: this.now() });
    this.previous = position;
  }
  stop(): void { this.running = false; this.removeStatus?.(); this.removeStatus = null; if (this.sampling) this.adapter.stop(); this.sampling = false; this.previous = null; this.manager.reset(); }
}
