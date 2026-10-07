import type { LocalProduct } from '../../../shared/types/local-flow';
import { useLocalFlow } from '../../app/local-flow-context';
import { Icon } from './Design';
export function Artwork({product,large=false}:{product:LocalProduct;large?:boolean}) {
  return product.preview ? <img className={large?'artwork large':'artwork'} src={product.preview} alt={product.name+' preview'}/> : <div className={large?'artwork large empty-art':'artwork empty-art'}><Icon name="lock"/><span>{product.installed?'Preview unavailable':'Artwork coming soon'}</span><small>{product.installed?'Installed local character':'Locked character concept'}</small></div>;
}
export function ProductBadges({product}:{product:LocalProduct}) {
  return <div className="product-badges"><span className={product.isFree?'badge success':'badge premium'}>{product.isFree?'FREE':'PREMIUM'}</span>{product.installed&&<span className="badge installed">INSTALLED</span>}{product.featured&&<span className="badge featured">FEATURED</span>}</div>;
}
export function CharacterCard({product,detail,choose=false,selected=false}:{product:LocalProduct;detail?:()=>void;choose?:boolean;selected?:boolean}) {
  const {snapshot,busy,run,buy}=useLocalFlow();
  const active=product.characterId!==null&&snapshot?.catalog.activeCharacterId===product.characterId;
  return <article className={`character-card${selected?' detail-selected':''}${active?' active-pack':''}`} data-product={product.id} onClick={event=>{if(detail&&!(event.target as HTMLElement).closest('button'))detail();}}>
    {detail?<button className="card-open" onClick={detail} aria-label={`View ${product.name} details`}><Artwork product={product}/><h3>{product.name}</h3></button>:<><Artwork product={product}/><h3 className="picker-card-title">{product.name}</h3></>}
    <div className="card-content"><ProductBadges product={product}/><p className="badges">{active?'Active companion':product.installed?'Installed locally':'Locked - Not installed'}</p><p>{product.description}</p>{!choose&&<p className="muted">{product.stateCount} Cursor States{product.concept?' - Planned':''}</p>}{!product.isFree&&<p className="product-price">${product.price.toFixed(2)} <span>{product.currency}</span></p>}
      <div className="actions">{product.installed&&product.characterId?<button disabled={busy||(choose&&active)} data-action="activate" onClick={()=>void run(()=>window.animeCursor.flow.activate(product.characterId!))}>{choose?(active?'Selected':'Select'):'Use Character'}</button>:product.isFree?<button disabled>Not installed</button>:<button data-action="buy" onClick={()=>void buy(product.id)}>Buy</button>}{detail&&<button className="secondary" onClick={detail}>Details</button>}</div>
    </div>
  </article>;
}
