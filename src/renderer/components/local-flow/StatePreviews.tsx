import { useEffect, useState } from 'react';
import type { LocalProduct } from '../../../shared/types/local-flow';
import { CURSOR_STATES, type CursorState } from '../../../shared/constants/cursor-states';
const cache = new Map<string, Promise<string | null>>();
function load(id: string, state: CursorState): Promise<string | null> {
  const key = `${id}:${state}`;
  const existing = cache.get(key); if (existing) return existing;
  const result = window.animeCursor.characters.getStateAsset(id, state).then(asset => {
    const url = asset?.resolvedState === state ? asset.dataUrl : null;
    if (!url) cache.delete(key); return url;
  }).catch(() => { cache.delete(key); return null; });
  cache.set(key, result); return result;
}
export function StatePreviews({ product }: { product: LocalProduct }) {
  const [images, setImages] = useState<Partial<Record<CursorState, string>>>({});
  const [selected, setSelected] = useState<CursorState>('normal');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false; setImages({}); setSelected('normal');
    if (product.installed && product.characterId) {
      setLoading(true);
      void Promise.all(CURSOR_STATES.map(async state => {
        return [state, await load(product.characterId!, state)] as const;
      })).then(values => { if (!cancelled) { setImages(Object.fromEntries(values.filter(([, url]) => url !== null))); setLoading(false); } });
    } else setLoading(false);
    return () => { cancelled = true; };
  }, [product.characterId, product.installed]);
  return <div className="state-previews" aria-busy={loading}>
    <div className="selected-state">{images[selected] ? <img src={images[selected]} alt={`${product.name} ${selected} state artwork`}/> : <span className="state-art-placeholder">{loading ? 'Loading local artwork...' : product.installed ? 'Preview unavailable' : 'Locked - Artwork coming soon'}</span>}<span>{selected}</span></div>
    <h3>16 Cursor States</h3><p className="muted">{product.installed ? 'Select a state to explore its original artwork.' : 'Planned states for this mock character. No pack is installed.'}</p>
    <div className="state-thumbnails state-list" aria-label="Character artwork previews">{CURSOR_STATES.map(state => <button key={state} className="secondary" data-state-preview={state} aria-label={`Preview ${state} artwork`} aria-pressed={selected === state} onClick={() => setSelected(state)}>{images[state] ? <img src={images[state]} alt={`${product.name} ${state}`}/> : <span className="state-lock" aria-hidden="true">?</span>}<span>{state}</span></button>)}</div>
  </div>;
}
