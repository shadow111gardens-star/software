import { useState } from 'react';
import { useLocalFlow } from '../app/local-flow-context';
import { CharacterCard } from '../components/local-flow/CharacterCard';
import { filterProducts } from '../../services/catalog/local-catalog';
import type { CatalogFilter } from '../../shared/types/local-flow';
export function Characters() {
  const { snapshot, products } = useLocalFlow(); const [filter, setFilter] = useState<CatalogFilter>('all');
  const installed = products.filter(product => product.installed); const matches = filterProducts(installed, filter);
  return <><h1>Characters</h1><p>Your installed local character library.</p><div className="filters" aria-label="Character filters">{(['all', 'installed', 'free', 'premium'] as const).map(value => <button key={value} className="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    {!installed.length ? <p>No characters installed yet.</p> : !matches.length ? <p>No characters match this filter.</p> : <div className="card-grid">{matches.map(product => <CharacterCard key={product.id} product={product} />)}</div>}
    {!!snapshot?.catalog.unavailable.length && <p role="status">{snapshot.catalog.unavailable.length} local pack(s) could not be loaded. Check the pack files or development diagnostics.</p>}
  </>;
}
