import { useState } from 'react';
import { useLocalFlow } from '../../app/local-flow-context';
import { CharacterCard } from './CharacterCard';
export function Onboarding() {
  const [step, setStep] = useState(1); const { snapshot, products, busy, run } = useLocalFlow();
  if (!snapshot) return null;
  const installed = products.filter(product => product.installed); const active = snapshot.catalog.characters.find(pack => pack.id === snapshot.catalog.activeCharacterId);
  return <main className="onboarding" data-onboarding-step={step}><p className="eyebrow">Anime Cursor · {step} of 3</p>
    {step === 1 && <><h1>Meet your cursor companion</h1><p>An anime character follows your real cursor across the desktop. Your cursor stays visible and works as usual.</p><p>Everything runs locally on your computer.</p><button className="primary" onClick={() => setStep(2)}>Get Started</button></>}
    {step === 2 && <><h1>Choose your companion</h1><p>Select an installed character to get started.</p><div className="card-grid">{installed.map(product => <CharacterCard key={product.id} product={product} choose />)}</div>{!installed.length && <p>No characters installed yet. Add a valid local pack to continue.</p>}<div className="actions"><button className="secondary" onClick={() => setStep(1)}>Back</button><button className="primary" disabled={!active || busy} onClick={() => setStep(3)}>Continue</button></div></>}
    {step === 3 && <><h1>Ready to meet {active?.name ?? 'your companion'}?</h1><p>Start the companion now. You can pause it, change its appearance, or choose another character at any time.</p><div className="actions"><button className="secondary" disabled={busy} onClick={() => setStep(2)}>Back</button><button className="primary" disabled={!active || busy} onClick={() => void run(() => window.animeCursor.flow.completeOnboarding())}>{busy ? 'Starting…' : 'Start Companion'}</button></div></>}
  </main>;
}
