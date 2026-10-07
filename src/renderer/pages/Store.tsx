import { useState } from 'react';
import { useLocalFlow } from '../app/local-flow-context';
import { CharacterCard, ProductBadges } from '../components/local-flow/CharacterCard';
import { StatePreviews } from '../components/local-flow/StatePreviews';
import { Icon } from '../components/local-flow/Design';
import { filterProducts } from '../../services/catalog/local-catalog';
import type { CatalogFilter, LocalProduct } from '../../shared/types/local-flow';
function ProductDetail({product}:{product:LocalProduct}) {
  const {busy,run,buy,snapshot}=useLocalFlow(); const [tab,setTab]=useState('Overview');
  return <section className="panel product-detail" aria-label="Character details" data-detail-product={product.id}>
    <ProductBadges product={product}/><h2>{product.name}</h2><p>{product.description}</p>
    <p className="installation-status">{product.installed?'Installed': 'Locked - Not installed'}{snapshot?.catalog.activeCharacterId===product.characterId&&product.characterId?' - Active companion':''}</p>
    {!product.isFree&&<p className="product-price">${product.price.toFixed(2)} <span>{product.currency}</span></p>}
    {product.installed&&product.characterId?<button disabled={busy} data-action="activate" onClick={()=>void run(()=>window.animeCursor.flow.activate(product.characterId!))}>Use Character</button>:product.isFree?<button disabled>Not installed</button>:<button data-action="buy" onClick={()=>void buy(product.id)}>Buy</button>}
    <StatePreviews product={product}/>
    <div className="detail-tabs" role="tablist" aria-label="Product information">{['Overview','States','Info'].map(t=><button key={t} id={`detail-${t}`} role="tab" aria-controls="product-tab-content" aria-selected={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
    <div id="product-tab-content" role="tabpanel" aria-labelledby={`detail-${tab}`} className="detail-tab-content">{tab==='Overview'?<><div className="feature"><span className="icon-tile"><Icon name="cursor"/></span><div><strong>16 Cursor States</strong><small>{product.concept?'Planned for this future character':'Original local artwork for every state'}</small></div></div><p>{product.concept?'A local mock catalog entry. Artwork and purchases will be available in a future update.':'Ready to use across your applications. Select any state above to preview the locally installed artwork.'}</p></>:tab==='States'?<p>Explore all 16 states in the preview grid above. The diagonal and diagonalSecondary states have separate previews.</p>:<><p>Version {product.version}</p><p>Platforms: {product.platforms.join(' / ')}</p><p>{product.installed?'Asset pack: '+product.characterId:'Mock product - No asset pack installed'}</p><p>{product.isFree?'Free character':'Premium character concept'}</p></>}</div>
  </section>;
}
export function Store() {
  const {products}=useLocalFlow(); const [filter,setFilter]=useState<CatalogFilter>('all'); const [query,setQuery]=useState(''); const [selected,setSelected]=useState<string|null>(null); const [sort,setSort]=useState('Featured');
  const matches=filterProducts(products,filter,query).slice().sort((a,b)=>sort==='Name'?a.name.localeCompare(b.name):sort==='Price'?a.price-b.price:Number(b.featured)-Number(a.featured));
  const detail=products.find(p=>p.id===selected)??products.find(p=>p.installed)??products[0]; const art=products.find(p=>p.preview);
  const clear=()=>{setFilter('all');setQuery('');}; const noInstalled=filter==='installed'&&!query.trim()&&!products.some(p=>p.installed);
  return <div className="store-page"><header className="page-header"><div><p className="eyebrow">STORE</p><h1>Character Store</h1><p>Discover new companions for your cursor.</p></div><label className="search"><span className="sr-only">Search characters</span><input type="search" value={query} placeholder="Search characters…" onChange={e=>setQuery(e.target.value)}/></label></header>
    <div className="store-layout"><div className="store-browser"><section className="store-banner"><div><h2>Make Your Cursor<br/><span>More Alive</span></h2><p>Discover a new friend for your desktop.</p><button onClick={clear}>Explore All <Icon name="chevron"/></button></div>{art?.preview&&<img src={art.preview} alt=""/>}<span className="banner-star" aria-hidden="true">✦</span></section>
      <div className="store-tools"><div className="filters" aria-label="Store filters">{(['all','featured','free','premium','installed'] as const).map(f=><button key={f} className="secondary" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div><label className="sort"><span className="sr-only">Sort characters</span><select value={sort} onChange={e=>setSort(e.target.value)}>{['Featured','Name','Price'].map(s=><option key={s} value={s}>Sort by: {s}</option>)}</select></label></div>
      <p className="store-result-count" role="status">{matches.length} {matches.length===1?'character':'characters'}</p>
      {matches.length?<div className="card-grid store-grid">{matches.map(p=><CharacterCard key={p.id} product={p} selected={detail?.id===p.id} detail={()=>setSelected(p.id)}/>)}</div>:<div className="panel empty-state"><Icon name="store"/><h2>{noInstalled?'No installed characters yet.':'No characters found'}</h2><p>{noInstalled?'Your installed companions will appear here.':'Try a different search.'}</p><button className="secondary" onClick={clear}>Clear filters</button></div>}
      <p className="catalog-note">Local catalog - Premium purchases coming soon</p>
    </div>{detail&&<ProductDetail key={detail.id} product={detail}/>}</div>
  </div>;
}
