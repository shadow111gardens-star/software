import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocalFlow } from '../../app/local-flow-context';
import { CharacterCard } from './CharacterCard';
export function Icon({ name }: { name: string }) {
 const paths: Record<string,string> = { heart:'M12 21 3 12C-2 5 7 0 12 6c5-6 14-1 9 6Z', monitor:'M3 3h18v14H3ZM12 17v5M7 22h10', lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4', home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', store:'M4 8h16l1 13H3ZM8 8V6a4 4 0 0 1 8 0v2', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2', pause:'M7 4v16M17 4v16', play:'m7 3 14 9-14 9Z', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M3 3l18 18', change:'M3 8h15l-4-4M21 16H6l4 4M3 8v5m18 3v-5', crown:'m2 6 5 4 5-7 5 7 5-4-3 15H5Z', bolt:'m13 2-9 12h7l-1 8 10-13h-8Z', cursor:'m4 2 15 13-8 1-4 6Z', chevron:'m9 5 7 7-7 7', info:'M12 11v7m0-12v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', sparkle:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z' };
 return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.sparkle}/></svg>;
}
export function SectionHeader({icon,title,description}: {icon:string;title:string;description?:string}) { return <div className="section-heading"><span className="icon-tile"><Icon name={icon}/></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>; }
export function Action({icon,children,onClick,disabled=false}: {icon:string;children:ReactNode;onClick():void;disabled?:boolean}) { return <button className="action-row secondary" disabled={disabled} onClick={onClick}><Icon name={icon}/><span>{children}</span><Icon name="chevron"/></button>; }
export function CharacterPreview({title='Preview on your screen'}:{title?:string}) {
 const {snapshot,products}=useLocalFlow(); if(!snapshot) return null;
 const active=products.find(p=>p.characterId===snapshot.catalog.activeCharacterId); const settings=snapshot.settings;
 return <section className="panel preview-card"><h2>{title}</h2><div className="preview-stage"><Icon name="cursor"/><span className="motion-lines"/>{active ? <img src={active.preview ?? ''} alt={active.name+' appearance preview'} style={{width:Math.min(190,Math.max(48,settings.characterSize*1.3)),opacity:settings.opacity,transform:`translate(${Math.max(-30,Math.min(30,settings.cursorOffset.x/4))}px, ${Math.max(-20,Math.min(20,settings.cursorOffset.y/4))}px)`,transition:`transform ${settings.smoothing*.5}s ease`}}/> : <p>No active character</p>}</div><p>Your companion follows your cursor across all your applications.</p></section>;
}
export function CharacterPicker({close}:{close():void}) {
 const ref=useRef<HTMLDialogElement>(null);const {products,snapshot}=useLocalFlow();
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} onCancel={close} aria-labelledby="picker-title"><div className="dialog-header"><div><p className="eyebrow">YOUR COMPANIONS</p><h2 id="picker-title">Change Character</h2></div><button className="secondary" onClick={close} aria-label="Close character picker">Close</button></div><p>Choose an installed character for your desktop.</p><div className="card-grid picker-grid">{products.filter(p=>p.installed).map(p=><CharacterCard key={p.id} product={p} choose/>)}</div>{!products.some(p=>p.installed)&&<p>No characters installed yet.</p>}{!!snapshot?.catalog.unavailable.length&&<p className="muted">{snapshot.catalog.unavailable.length} unavailable packs could not be loaded.</p>}</dialog>;
}

