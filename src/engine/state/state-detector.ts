import { isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import type { CursorContext } from '../../shared/types/state';
export class StateDetector {
  detect(context: CursorContext): { state: CursorState; source: string; reason: string } {
    if (context.trackingStatus !== 'active') return { state: 'extra', source: 'tracking-inactive', reason: 'unrecognized/unsupported cursor' };
    const signal = context.semantic;
    if (!signal.error && signal.reliable && isCursorState(signal.state) && signal.state !== 'extra' && context.timestamp - signal.timestamp <= 3000 && signal.timestamp <= context.timestamp) return { state: signal.state, source: signal.source, reason: 'recognized OS cursor' };
    return { state: 'extra', source: signal.error ? 'platform-error-fallback' : 'unknown-fallback', reason: 'unrecognized/unsupported cursor' };
  }
}
