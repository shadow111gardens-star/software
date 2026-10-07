import { useState } from 'react';
import { useLocalFlow } from '../../app/local-flow-context';
import { Icon } from './Design';
import type { LocalProduct } from '../../../shared/types/local-flow';

function Feature({ icon, title, children }: { icon: string; title: string; children: string }) {
  return <div className="setup-feature"><span className="setup-feature-icon"><Icon name={icon}/></span><div><strong>{title}</strong><p>{children}</p></div></div>;
}
function SetupArtwork({ product, ready = false }: { product?: LocalProduct; ready?: boolean }) {
  return <div className="setup-artwork" aria-label="Companion artwork">
    <div className="setup-orbit"/><div className="setup-orbit second"/>
    <span className="setup-star star-one" aria-hidden="true">✦</span><span className="setup-star star-two" aria-hidden="true">✦</span><span className="setup-star star-three" aria-hidden="true">✦</span><span className="setup-star star-four" aria-hidden="true">{ready?'♥':'✧'}</span>
    <span className="setup-cursor"><Icon name="cursor"/></span>
    {product?.preview?<img src={product.preview} alt={product.name+' companion artwork'}/>:<p>No character artwork available</p>}
    {ready&&<span className="setup-speech">Let’s<br/>go! ♡</span>}
  </div>;
}
function LockedCard({name}:{name:string}) {
  return <article className="setup-choice locked" aria-label={name+' locked premium concept'}><div className="locked-art"><Icon name="sparkle"/><span className="setup-lock"><Icon name="lock"/></span><p>Artwork coming soon</p></div><h2>{name} <span className="badge premium">★ Premium</span></h2><p>Available in Store</p><small>Concept preview · Purchases coming soon</small></article>;
}
export function Onboarding() {
  const [step,setStep]=useState(1); const {snapshot,products,busy,run}=useLocalFlow();
  if(!snapshot)return null;
  const aiko=products.find(p=>p.characterId==='aiko'&&p.installed)??products.find(p=>p.installed);
  const selected=!!aiko&&snapshot.catalog.activeCharacterId===aiko.characterId;
  const changeStep=(next:number)=>{setStep(next);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.setup-content h1')?.focus());};
  const select=()=>{if(aiko?.characterId&&!selected)void run(()=>window.animeCursor.flow.activate(aiko.characterId!));};
  return <main className={'onboarding setup-screen setup-step-'+step} data-onboarding-step={step}>
    <header className="setup-navigation"><div>{step>1&&<button aria-label="Back" className="setup-back" disabled={busy} onClick={()=>changeStep(step-1)}><span aria-hidden="true">←</span>Back</button>}</div><div className="setup-progress" aria-label={'Step '+step+' of 3'}><div className="setup-progress-bars">{[1,2,3].map(n=><span key={n} className={n<=step?'complete':''} aria-current={n===step?'step':undefined}/>)}</div><p>Step {step} of 3</p></div><button className="setup-skip" disabled={busy} onClick={()=>void run(()=>window.animeCursor.flow.skipOnboarding())}>Skip Setup</button></header>
    <div className="setup-content">
    {step===1&&<div className="setup-welcome"><div className="setup-copy"><div className="setup-brand"><span className="brand-logo"><Icon name="sparkle"/></span><strong>Anime Cursor</strong></div><h1 tabIndex={-1}>Meet Your New<br/>Cursor <span>Companion</span></h1><p className="setup-subtitle">A cute anime companion who follows<br className="desktop-break"/> your cursor across all your applications.</p><div className="setup-features"><Feature icon="sparkle" title="16 Unique Cursor States">Adapts to what you’re doing</Feature><Feature icon="heart" title="Always by Your Side">Follows your cursor everywhere</Feature><Feature icon="settings" title="Customizable">Adjust size, distance, opacity and more</Feature><Feature icon="monitor" title="Works Across All Apps">Games, browsers, editors and more</Feature></div></div><div className="setup-visual"><SetupArtwork product={aiko}/><button aria-label="Get Started" className="setup-primary" disabled={busy} onClick={()=>changeStep(2)}>Get Started<span aria-hidden="true">→</span></button></div></div>}
    {step===2&&<div className="setup-selection"><h1 tabIndex={-1}>Choose <span>Your Companion</span></h1><p className="setup-subtitle">Select a character to be your cursor companion.<br/>You can always change this later in the app.</p><div className="setup-choices">{aiko?<button className={'setup-choice installed'+(selected?' selected':'')} data-product={aiko.id} aria-pressed={selected} disabled={busy} onClick={select}>{selected&&<span className="setup-check" aria-label="Selected">✓</span>}<img src={aiko.preview??''} alt={aiko.name+' preview'}/><h2>{aiko.name} <span className="badge success">★ Installed</span></h2><p>A cheerful companion who follows your cursor.</p></button>:<div className="setup-choice"><h2>No installed character</h2><p>Add a valid local pack or skip setup.</p></div>}<LockedCard name="Neko"/><LockedCard name="Yuki"/></div><div className="setup-selection-footer"><span/><div className="setup-dots" aria-label="Setup progress">{[1,2,3].map(n=><i key={n} className={n===step?'active':''}/>)}</div><button aria-label="Continue" className="setup-primary" disabled={busy||!aiko||!selected} onClick={()=>changeStep(3)}>Continue<span aria-hidden="true">→</span></button></div></div>}
    {step===3&&<div className="setup-ready"><div className="setup-ready-main"><div className="setup-copy"><h1 tabIndex={-1}>You’re <span>All Set!</span></h1><p className="setup-subtitle">Your companion is ready to follow your cursor!</p><div className="setup-features"><Feature icon="bolt" title={(aiko?.name??'Your companion')+' will follow your cursor'}>Across all your applications</Feature><Feature icon="settings" title="You can customize everything">Change size, distance, opacity and more</Feature><Feature icon="store" title="Explore the Store">Discover more characters and premium packs</Feature></div></div><SetupArtwork product={aiko} ready/></div><footer className="setup-ready-footer"><button className="setup-primary" disabled={busy||!aiko} onClick={()=>void run(()=>window.animeCursor.flow.completeOnboarding())}><Icon name="play"/>{busy?'Starting…':'Start Companion'}</button><p>You can pause, hide, or change your companion anytime.</p></footer></div>}
    </div>
  </main>;
}

