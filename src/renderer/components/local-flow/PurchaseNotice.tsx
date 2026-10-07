import { useEffect, useRef } from 'react';
import { Icon } from './Design';
export function PurchaseNotice({close}:{close():void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="purchase-notice" aria-labelledby="purchase-title" aria-describedby="purchase-description" onClose={close}>
    <span className="icon-tile"><Icon name="store"/></span>
    <p className="eyebrow">MORE COMPANIONS AWAIT</p>
    <h2 id="purchase-title">Purchases coming soon</h2>
    <p id="purchase-description">Premium character purchases will be available in a future update.</p>
    <button autoFocus onClick={()=>ref.current?.close()}>Got it</button>
  </dialog>;
}
