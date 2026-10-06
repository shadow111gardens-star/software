import { useLocalFlow } from './local-flow-context';
import { APP_PAGES } from '../../shared/types/local-flow';
import { Onboarding } from '../components/local-flow/Onboarding';
import { Home } from '../pages/Home';
import { Characters } from '../pages/Characters';
import { Store } from '../pages/Store';
import { Settings } from '../pages/Settings';
export function AppShell() {
  const { snapshot, busy, error, message, run } = useLocalFlow();
  return <><header className="titlebar"><span>Anime Cursor</span><div className="window-controls"><button aria-label="Minimize" onClick={() => void window.animeCursor.minimize()}>−</button><button aria-label="Toggle maximize" onClick={() => void window.animeCursor.toggleMaximize()}>□</button><button aria-label="Close to tray" onClick={() => void window.animeCursor.close()}>×</button></div></header>
    <div className="feedback" aria-live="polite">{(error || snapshot?.error) && <p role="alert">{error || snapshot?.error}</p>}{message && <p role="status">{message}</p>}</div>
    {!snapshot ? <main><p role="status">Loading Anime Cursor…</p>{error && <button onClick={() => location.reload()}>Try again</button>}</main> : <div data-app-ready="true">{!snapshot.settings.onboardingCompleted ? <Onboarding /> : <div className="app-layout"><aside><nav aria-label="Main navigation">{APP_PAGES.map(page => <button key={page} data-page={page} className="nav-item" aria-current={snapshot.page === page ? 'page' : undefined} disabled={busy} onClick={() => void run(() => window.animeCursor.flow.navigate(page))}>{page[0].toUpperCase() + page.slice(1)}</button>)}</nav><p className="muted">Local · Phase 1</p><button className="secondary" onClick={() => void window.animeCursor.companion.quit()}>Quit</button></aside><main data-current-page={snapshot.page}>{snapshot.page === 'home' ? <Home /> : snapshot.page === 'characters' ? <Characters /> : snapshot.page === 'store' ? <Store /> : <Settings />}</main></div>}</div>}
  </>;
}
