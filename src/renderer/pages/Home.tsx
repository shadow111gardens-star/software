import { useLocalFlow } from '../app/local-flow-context';
import { Artwork } from '../components/local-flow/CharacterCard';
import { Appearance } from '../components/local-flow/Appearance';
export function Home() {
  const { snapshot, products, busy, run } = useLocalFlow(); if (!snapshot) return null;
  const active = products.find(product => product.characterId === snapshot.catalog.activeCharacterId);
  const running = ['running', 'hidden'].includes(snapshot.companion.status);
  return <><h1>Home</h1><section className="companion-summary"><div>{active && <Artwork product={active} />}</div><div><p className="eyebrow">Your companion</p><h2>{active?.name ?? 'No active companion'}</h2><p data-flow-status className="status">Companion {snapshot.status}</p><p>{snapshot.settings.companionEnabled ? 'Enabled' : 'Disabled'} · {snapshot.companion.visible ? 'Visible' : 'Not visible'}</p>
    {!active && <p>Choose a character to start your companion.</p>}<div className="actions"><button disabled={busy || !active} onClick={() => void run(() => window.animeCursor.flow.companion(running ? 'pause' : 'resume'))}>{running ? 'Pause' : 'Resume'}</button><button className="secondary" disabled={busy || !running} onClick={() => void run(() => window.animeCursor.flow.companion(snapshot.companion.status === 'hidden' ? 'show' : 'hide'))}>{snapshot.companion.status === 'hidden' ? 'Show Companion' : 'Hide Companion'}</button></div></div></section>
    <section><h2>Quick actions</h2><div className="actions"><button className="secondary" disabled={busy} onClick={() => void run(() => window.animeCursor.flow.navigate('characters'))}>Change Character</button><button className="secondary" disabled={busy} onClick={() => void run(() => window.animeCursor.flow.navigate('characters'))}>Open Characters</button><button className="secondary" disabled={busy} onClick={() => void run(() => window.animeCursor.flow.navigate('settings'))}>Open Settings</button></div></section><Appearance />
  </>;
}
