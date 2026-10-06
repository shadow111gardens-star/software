import { isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import type { CursorContext } from '../../shared/types/state';
export class StateDetector {
  detect(context: CursorContext): { state: CursorState; source: string } {
    if (context.trackingStatus !== 'active') return { state: 'normal', source: 'tracking-inactive' };
    const signal = context.semantic;
    if (!signal.error && signal.reliable && isCursorState(signal.state) && context.timestamp - signal.timestamp <= 3000 && signal.timestamp <= context.timestamp) return { state: signal.state, source: signal.source };
    return { state: 'normal', source: signal.error ? 'platform-error-fallback' : 'unknown-fallback' };
  }
}
