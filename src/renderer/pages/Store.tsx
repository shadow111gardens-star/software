import { useEffect, useRef, useState } from 'react';
import { useLocalFlow } from '../app/local-flow-context';
import { Artwork, CharacterCard } from '../components/local-flow/CharacterCard';
import { filterProducts } from '../../services/catalog/local-catalog';
import type { CatalogFilter, LocalProduct } from '../../shared/types/local-flow';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
function ProductDetail({ product, close }: { product: LocalProduct; close(): void }) {
  const dialog = useRef<HTMLDialogElement>(null); const { busy, run, buy, message } = useLocalFlow();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={close} aria-labelledby="product-title"><div className="detail"><button className="secondary" onClick={close}>Close details</button><Artwork product={product} large /><h2 id="product-title">{product.name}</h2><p>{product.description}</p><p>{product.isFree ? 'Free' : `Premium · $${product.price.toFixed(2)} ${product.currency}`}</p><p>{product.platforms.join(' / ')} · Version {product.version}</p><h3>{product.concept ? '16 planned state slots' : '16 included states'}</h3><div className="state-list">{CURSOR_STATES.map(state => <span key={state}>{state}</span>)}</div>{product.installed && product.characterId ? <button disabled={busy} onClick={() => void run(() => window.animeCursor.flow.activate(product.characterId!))}>Activate</button> : <button onClick={() => void buy(product.id)}>Buy</button>}{message && <p role="status">{message}</p>}</div></dialog>;
}
export function Store() {
  const { products } = useLocalFlow(); const [filter, setFilter] = useState<CatalogFilter>('featured'); const [query, setQuery] = useState(''); const [detail, setDetail] = useState<LocalProduct | null>(null);
  const matches = filterProducts(products, filter, query);
  return <><h1>Store</h1><p>A local preview catalog. Purchases and downloads are not available in this version.</p><label className="search">Search characters<input type="search" value={query} placeholder="Search by name" onChange={event => setQuery(event.target.value)} /></label><div className="filters" aria-label="Store filters">{(['featured', 'all', 'free', 'premium'] as const).map(value => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    {matches.length ? <div className="card-grid">{matches.map(product => <CharacterCard key={product.id} product={product} detail={() => setDetail(product)} />)}</div> : <p>No characters match your search.</p>}{detail && <ProductDetail product={detail} close={() => setDetail(null)} />}
  </>;
}
