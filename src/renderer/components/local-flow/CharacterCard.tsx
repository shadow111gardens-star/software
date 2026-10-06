import type { LocalProduct } from '../../../shared/types/local-flow';
import { useLocalFlow } from '../../app/local-flow-context';
export function Artwork({ product, large = false }: { product: LocalProduct; large?: boolean }) {
  return product.preview ? <img className={large ? 'artwork large' : 'artwork'} src={product.preview} alt={`${product.name} preview`} /> : <div className={large ? 'artwork large empty-art' : 'artwork empty-art'}>Preview coming soon</div>;
}
export function CharacterCard({ product, detail, choose = false }: { product: LocalProduct; detail?: () => void; choose?: boolean }) {
  const { snapshot, busy, run, buy } = useLocalFlow(); const active = product.characterId !== null && snapshot?.catalog.activeCharacterId === product.characterId;
  return <article className="character-card" data-product={product.id}><Artwork product={product} /><div className="card-content"><h3>{product.name}</h3>
    <p className="badges">{product.isFree ? 'Free' : 'Premium'} · {active ? 'Active' : product.installed ? 'Installed' : 'Concept'}</p><p>{product.description}</p>
    {!choose && <p className="muted">{product.platforms.map(value => value === 'windows' ? 'Windows' : 'macOS').join(' / ')} · {product.stateCount} states{!product.installed && ` · $${product.price.toFixed(2)} ${product.currency}`}</p>}
    <div className="actions">{product.installed && product.characterId ? <button disabled={busy || active} data-action="activate" onClick={() => void run(() => window.animeCursor.flow.activate(product.characterId!))}>{active ? 'Selected' : choose ? 'Select' : 'Activate'}</button> : <button onClick={() => void buy(product.id)}>Buy</button>}{detail && <button className="secondary" onClick={detail}>Details</button>}</div>
  </div></article>;
}
