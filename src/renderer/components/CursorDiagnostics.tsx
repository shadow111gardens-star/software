import { useEffect, useState } from 'react';
import type { CursorSnapshot } from '../../shared/types/cursor';
export function CursorDiagnostics() {
  const [snapshot, setSnapshot] = useState<CursorSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await window.animeCursor.cursor.getSnapshot();
        if (disposed) return;
        setSnapshot(next);
        if (next) timer = setTimeout(() => void poll(), 250);
      } catch { if (!disposed) setError('Cursor diagnostics unavailable.'); }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, []);
  if (!snapshot && !error) return null;
  const control = async (start: boolean) => {
    try { setSnapshot(await (start ? window.animeCursor.cursor.start() : window.animeCursor.cursor.stop())); }
    catch { setError('Cursor control failed.'); }
  };
  return <section aria-label="Development cursor diagnostics"><h2>Cursor diagnostics</h2><p data-cursor-status>{snapshot?.status ?? 'unavailable'}</p>
    {snapshot?.position && <p>X: {snapshot.position.x} Y: {snapshot.position.y} (DIP)<br />Display: {snapshot.position.displayId} Scale: {snapshot.position.scaleFactor}<br />Sample: {snapshot.position.timestamp}</p>}
    <button onClick={() => void control(true)}>Start</button><button onClick={() => void control(false)}>Stop</button>
    {(snapshot?.error || error) && <p role="alert">{snapshot?.error || error}</p>}
  </section>;
}
