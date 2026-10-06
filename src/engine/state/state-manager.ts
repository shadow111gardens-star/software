import { isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import type { CursorContext, StateSnapshot } from '../../shared/types/state';
import { StateDetector } from './state-detector';
export type StateListener = (state: CursorState) => void;
export class StateManager {
  private snapshot: StateSnapshot = { state: 'normal', source: 'initial', override: null, context: null };
  private listeners = new Set<StateListener>();
  constructor(private readonly detector = new StateDetector()) {}
  getCurrentState(): CursorState { return this.snapshot.state; }
  getSnapshot(): StateSnapshot { return structuredClone(this.snapshot); }
  update(context: CursorContext): void {
    this.snapshot.context = context;
    const detected = this.detector.detect(context);
    const override = context.trackingStatus === 'active' ? this.snapshot.override : null;
    this.commit(override ?? detected.state, override ? 'development-override' : detected.source);
  }
  setOverride(input: unknown): StateSnapshot {
    // Invalid input never enters the character resolver. Null explicitly returns to AUTO.
    this.snapshot.override = input === null ? null : isCursorState(input) ? input : 'normal';
    if (this.snapshot.context) this.update(this.snapshot.context);
    else this.commit(this.snapshot.override ?? 'normal', this.snapshot.override ? 'development-override' : 'initial');
    return this.getSnapshot();
  }
  subscribe(listener: StateListener): () => void { this.listeners.add(listener); return () => this.unsubscribe(listener); }
  unsubscribe(listener: StateListener): void { this.listeners.delete(listener); }
  reset(): void { this.snapshot.context = null; this.snapshot.override = null; this.commit('normal', 'reset'); }
  private commit(state: CursorState, source: string): void {
    const changed = state !== this.snapshot.state; this.snapshot.state = state; this.snapshot.source = source;
    if (changed) for (const listener of [...this.listeners]) { try { listener(state); } catch (error) { console.error('[state] Subscriber failed', error); } }
  }
}
