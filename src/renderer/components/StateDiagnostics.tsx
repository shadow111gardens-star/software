import { useEffect, useState } from 'react';
import { CURSOR_STATES, type CursorState } from '../../shared/constants/cursor-states';
import type { StateSnapshot } from '../../shared/types/state';
import type { CompanionSnapshot } from '../../shared/types/overlay';
export function StateDiagnostics() {
  const [state, setState] = useState<StateSnapshot | null>(null);
  const [companion, setCompanion] = useState<CompanionSnapshot | null>(null);
  const [error, setError] = useState(''); const [cycling, setCycling] = useState(false);
  useEffect(() => {
    let mounted = true; let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const snapshot = await window.animeCursor.state.getSnapshot();
        if (!mounted || !snapshot) return;
        setState(snapshot); setCompanion(await window.animeCursor.companion.getSnapshot());
        if (mounted) timer = setTimeout(() => void read(), 250);
      } catch (failure) { if (mounted) setError(String(failure)); }
    };
    void read(); return () => { mounted = false; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!cycling) return;
    let index = 0; let disposed = false; let timer: ReturnType<typeof setTimeout>;
    const next = async () => {
      try { await window.animeCursor.state.setOverride(CURSOR_STATES[index++ % CURSOR_STATES.length]); if (!disposed) timer = setTimeout(() => void next(), 900); }
      catch (failure) { if (!disposed) { setError(String(failure)); setCycling(false); } }
    };
    void next(); return () => { disposed = true; clearTimeout(timer); };
  }, [cycling]);
  if (!state) return null;
  const select = (value: string) => { setCycling(false); void window.animeCursor.state.setOverride(value === 'AUTO' ? null : value as CursorState).then(setState).catch(failure => setError(String(failure))); };
  return <section aria-label="Development state diagnostics"><h2>State diagnostics (development only)</h2>
    <p>Detected state: <strong>{state.detectedState}</strong><br/>Reason: {state.reason}</p>
    <p>Current state: <strong>{state.state}</strong> · Source: {state.source} · Mode: {state.override ?? 'AUTO'}</p>
    <label>Override <select value={state.override ?? 'AUTO'} onChange={event => select(event.target.value)}><option value="AUTO">AUTO</option>{CURSOR_STATES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <button onClick={() => select('AUTO')}>Return to AUTO</button><button onClick={() => setCycling(value => !value)}>{cycling ? 'Pause cycle' : 'Cycle 16 states'}</button>
    <p>Character: {companion?.characterId ?? 'none'} · Resolved state asset: {companion?.characterId ? `${companion.characterId}/${companion.state}` : 'none'} · Tracking: {state.context?.trackingStatus ?? 'stopped'} · Cursor: {state.context?.position ? `${state.context.position.x}, ${state.context.position.y}` : 'unavailable'}</p>
    {state.context?.semantic.error && <p role="alert">{state.context.semantic.error}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
