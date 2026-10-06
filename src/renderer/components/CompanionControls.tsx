import { useState } from 'react';
import type { CompanionSnapshot } from '../../shared/types/overlay';
export function CompanionControls() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: 'start' | 'stop' | 'show' | 'hide') => {
    setPending(true); setError('');
    try { setSnapshot(await window.animeCursor.companion[action]()); }
    catch { setError('Companion request failed. See application logs.'); }
    finally { setPending(false); }
  };
  return <section aria-label="Temporary companion controls"><h2>Companion controls</h2>
    <button disabled={pending} onClick={() => void run('start')}>Start companion</button>
    <button disabled={pending} onClick={() => void run('stop')}>Stop companion</button>
    <button disabled={pending} onClick={() => void run('hide')}>Hide</button>
    <button disabled={pending} onClick={() => void run('show')}>Show</button>
    <button onClick={() => void window.animeCursor.companion.quit()}>Quit app</button>
    <p data-companion-status>{snapshot ? `${snapshot.status} / ${snapshot.characterId ?? 'none'} / ${snapshot.state}` : 'Companion is initially stopped.'}</p>
    {(snapshot?.error || error) && <p role="alert">{snapshot?.error || error}</p>}
  </section>;
}
