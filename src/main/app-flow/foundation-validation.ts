import { app, type BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
import type { CompanionController } from '../../services/companion/companion-controller';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import type { ElectronTrayAdapter } from '../../platform/tray/electron-tray-adapter';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
export async function validateFoundation(window: BrowserWindow, flow: LocalAppFlow, companion: CompanionController, cursor: CursorTrackingService, tray: ElectronTrayAdapter): Promise<void> {
  let code = 0;
  try {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const end = Date.now() + 10000; while (!document.querySelector('[data-app-ready]')) { if (Date.now() > end) throw new Error('Renderer not ready'); await new Promise(resolve => setTimeout(resolve, 25)); }
      const snapshot = await window.animeCursor.flow.getSnapshot(); const catalog = await window.animeCursor.characters.getCharacters();
      const assets = [];
      for (const pack of catalog.characters) for (const state of ${JSON.stringify(CURSOR_STATES)}) { const asset = await window.animeCursor.characters.getStateAsset(pack.id, state); if (!asset || asset.fallback) throw new Error('Asset failed'); const image = new Image(); image.src = asset.dataUrl; await image.decode(); assets.push({ state, width: image.naturalWidth }); }
      return { page: snapshot.page, onboardingCompleted: snapshot.settings.onboardingCompleted, assets, stateDebug: await window.animeCursor.state.getSnapshot(), overrideDenied: await window.animeCursor.state.setOverride('extra').then(() => false, () => true), node: typeof require, process: typeof process, ready: !!document.querySelector('[data-app-ready]') };
    })()`);
    assert.equal(result.ready, true); assert.equal(result.node, 'undefined'); assert.equal(result.process, 'undefined'); assert.equal(result.stateDebug, null); assert.equal(result.overrideDenied, true); assert.equal(tray.isCreated(), true);
    console.info(`[smoke] ${JSON.stringify({ passed: true, ...result })}`);
  } catch (error) { console.error('[smoke]', error); code = 1; }
  finally { companion.dispose(); cursor.dispose(); tray.dispose(); flow.dispose(); app.exit(code); }
}
