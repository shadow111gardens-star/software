import { useEffect, useState } from 'react';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import type { CharacterCatalog } from '../../shared/types/character';
export function CharacterDiagnostics() {
  const [catalog, setCatalog] = useState<CharacterCatalog | null>(null);
  const [status, setStatus] = useState('Checking local character packs...');
  const [error, setError] = useState('');
  useEffect(() => { let cancelled = false;
    void window.animeCursor.characters.getCharacters().then(async result => {
      if (cancelled) return;
      setCatalog(result);
      if (!result.activeCharacterId) { setStatus('No valid character packs available. See local asset documentation and pack diagnostics.'); return; }
      const assets = await Promise.all(CURSOR_STATES.map(state => window.animeCursor.characters.getStateAsset(result.activeCharacterId!, state)));
      if (!cancelled) setStatus(`${result.activeCharacterId}: ${assets.filter(asset => asset && !asset.fallback).length}/${CURSOR_STATES.length} state assets resolved.`);
    }).catch(() => { if (!cancelled) setError('Character system could not be loaded. Check development logs.'); });
    return () => { cancelled = true; };
  }, []);
  const activate = async (id: string) => {
    setError('');
    try { await window.animeCursor.characters.setActiveCharacter(id); setCatalog(await window.animeCursor.characters.getCharacters()); setStatus(`Active character: ${id}`); }
    catch { setError('Unable to activate character. Check development logs.'); }
  };
  return <section aria-label="Character development diagnostics"><p data-character-status>{status}</p>
    {catalog && <><label>Active character <select value={catalog.activeCharacterId ?? ''} disabled={!catalog.characters.length} onChange={event => void activate(event.target.value)}>
      {!catalog.characters.length && <option value="">None available</option>}
      {catalog.characters.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
    </select></label><p>{catalog.characters.length} valid packs; {catalog.unavailable.length} unavailable packs.</p>
    {catalog.unavailable.map((problem, index) => <p key={`${problem.directory}-${index}`}>{problem.directory}: {problem.errors.join('; ')}</p>)}</>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
