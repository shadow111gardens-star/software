import { app, type BrowserWindow, type Menu, type MenuItem } from 'electron';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
import type { CompanionController } from '../../services/companion/companion-controller';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import type { CursorStateEngine } from '../../services/state/cursor-state-engine';
import type { ElectronTrayAdapter } from '../../platform/tray/electron-tray-adapter';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean | Promise<boolean>): Promise<void> { const end = Date.now() + 15000; while (!await check()) { if (Date.now() > end) throw new Error('Local flow validation timed out'); await delay(40); } }
function item(menu: Menu | null, id: string): MenuItem | undefined { for (const entry of menu?.items ?? []) { if (entry.id === id) return entry; const nested = item(entry.submenu ?? null, id); if (nested) return nested; } return undefined; }
export async function validateLocalFlow(main: BrowserWindow, flow: LocalAppFlow, companion: CompanionController, cursor: CursorTrackingService, engine: CursorStateEngine, tray: ElectronTrayAdapter, phase: string): Promise<void> {
  const execute = (code: string) => main.webContents.executeJavaScript(code);
  const click = async (label: string, scope = 'document') => { await until(async () => await execute(`Array.from(${scope}.querySelectorAll('button')).some(value => value.textContent.trim() === ${JSON.stringify(label)} && !value.disabled)`)); await execute(`(() => { const button = Array.from(${scope}.querySelectorAll('button')).find(value => value.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(label)}); button.click(); })()`); await delay(50); };
  const page = async (value: string) => { await execute(`document.querySelector('[data-page="${value}"]').click()`); await until(async () => await execute(`document.querySelector('main[data-current-page]')?.dataset.currentPage === '${value}'`)); };
  const number = async (field: string, value: number) => { await until(async () => await execute(`!!document.querySelector('[data-preference="${field}"]') && !document.querySelector('[data-preference="${field}"]').disabled`)); await delay(100); await execute(`(async () => { const input = document.querySelector('[data-preference="${field}"]'); input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${value}'); input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)); input.blur(); })()`); };
  const invokeTray = (id: string) => { const entry = item(tray.getMenu(), id); assert.ok(entry && entry.enabled, `Tray action ${id}`); entry.click(entry, main, {} as Electron.KeyboardEvent); };
  const capture = async (name: string) => { await delay(80); await writeFile(`dist/validation/flow-${name}.png`, (await main.webContents.capturePage(await execute('({ x: 0, y: 0, width: innerWidth, height: innerHeight })'))).toPNG()); };
  try {
    await mkdir('dist/validation', { recursive: true });
    await until(async () => await execute(`!!document.querySelector('[data-app-ready]')`));
    assert.equal(tray.isCreated(), true);
    if (phase === 'first') {
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, false); assert.equal(companion.getSnapshot().status, 'stopped');
      await capture('welcome'); await click('Get Started'); await until(async () => await execute(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep === '2'`));
      assert.equal(await execute(`!!document.querySelector('[data-product="aiko"]')`), true); await capture('choose');
      await click('Continue'); await click('Start Companion'); await until(() => flow.getSnapshot().settings.onboardingCompleted && companion.getSnapshot().status === 'running');
      await until(async () => await execute(`!!document.querySelector('[data-page="home"]')`));
      assert.equal(flow.getSnapshot().settings.companionEnabled, true); await capture('home');
      await click('Hide Companion'); await until(() => flow.getSnapshot().status === 'Hidden'); assert.equal(flow.getSnapshot().settings.companionEnabled, true);
      await click('Show Companion'); await until(() => flow.getSnapshot().status === 'Active');
      await click('Pause'); await until(() => flow.getSnapshot().status === 'Paused'); assert.equal(flow.getSnapshot().settings.companionEnabled, false);
      await click('Resume'); await until(() => flow.getSnapshot().status === 'Active');
      engine.manager.setOverride('text'); await until(() => companion.getSnapshot().state === 'text');
      await page('characters'); await capture('characters');
      await execute(`document.querySelector('[data-product="test-future"] [data-action="activate"]').click()`);
      await until(() => flow.getSnapshot().settings.activeCharacterId === 'test-future' && companion.getSnapshot().characterId === 'test-future'); assert.equal(companion.getSnapshot().state, 'text');
      engine.manager.setOverride(null);
      await page('settings'); await until(async () => await execute(`document.querySelectorAll('[aria-label="Development state diagnostics"] select option').length === 17`)); await number('size', 132); await until(() => flow.getSnapshot().settings.characterSize === 132);
      await number('offset-x', 38); await until(() => flow.getSnapshot().settings.cursorOffset.x === 38);
      await number('opacity', 65); await until(() => flow.getSnapshot().settings.opacity === .65);
      await number('smoothing', 20); await until(() => flow.getSnapshot().settings.smoothing === .2);
      assert.equal(Math.max(companion.getSnapshot().bounds!.width, companion.getSnapshot().bounds!.height), 136);
      await capture('settings'); await page('store');
      await click('Premium', `document.querySelector('[aria-label="Store filters"]')`);
      const before = JSON.stringify(flow.getSnapshot().settings); await click('Buy'); await until(async () => (await execute('document.body.textContent')).includes('Purchases will be available soon.'));
      assert.equal(JSON.stringify(flow.getSnapshot().settings), before); await capture('store'); await click('Details');
      assert.equal(await execute(`document.querySelector('dialog .state-list').children.length`), 16); await click('Buy', `document.querySelector('dialog')`);
      await until(async () => (await execute(`document.querySelector('dialog').textContent`)).includes('No payment was made.')); await capture('product-detail'); await click('Close details');
      await execute(`(() => { const input = document.querySelector('input[type="search"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'no-such-product'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await until(async () => (await execute('document.body.textContent')).includes('No characters match your search.'));
      await page('home');
      const layouts = []; const originalBounds = main.getBounds();
      for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080]]) {
        main.setContentSize(width, height); await until(async () => await execute(`innerWidth === ${width} && innerHeight === ${height}`));
        await delay(80); const overflow = await execute('document.documentElement.scrollWidth > window.innerWidth'); assert.equal(overflow, false, `No horizontal overflow at ${width}`); layouts.push({ width, height, overflow }); await capture(`home-${width}`);
      }
      main.setBounds(originalBounds);
      await execute('window.animeCursor.close()'); await until(() => !main.isVisible()); assert.equal(main.isDestroyed(), false); assert.equal(companion.getSnapshot().status, 'running');
      invokeTray('settings'); await until(() => main.isVisible()); await until(async () => await execute(`document.querySelector('[data-current-page]')?.dataset.currentPage === 'settings'`));
      invokeTray('hide-app'); assert.equal(main.isVisible(), false); invokeTray('show-app'); assert.equal(main.isVisible(), true);
      invokeTray('hide-companion'); await until(() => flow.getSnapshot().status === 'Hidden'); invokeTray('show-companion'); await until(() => flow.getSnapshot().status === 'Active');
      invokeTray('pause-companion'); await until(() => flow.getSnapshot().status === 'Paused'); invokeTray('resume-companion'); await until(() => flow.getSnapshot().status === 'Active');
      invokeTray('character-aiko'); await until(() => flow.getSnapshot().settings.activeCharacterId === 'aiko'); invokeTray('character-test-future'); await until(() => flow.getSnapshot().settings.activeCharacterId === 'test-future');
      invokeTray('open-characters'); await until(async () => await execute(`document.querySelector('[data-current-page]')?.dataset.currentPage === 'characters'`));
      await flow.preferences({ startMinimized: true, startCompanionAutomatically: true });
      console.info(`[flow-check] layouts ${JSON.stringify(layouts)}`);
    } else {
      const snapshot = flow.getSnapshot(); assert.equal(snapshot.settings.onboardingCompleted, true); assert.equal(snapshot.settings.activeCharacterId, 'test-future'); assert.equal(snapshot.settings.characterSize, 132); assert.equal(snapshot.settings.opacity, .65); assert.equal(snapshot.settings.cursorOffset.x, 38); assert.equal(snapshot.settings.smoothing, .2);
      assert.equal(main.isVisible(), false, 'Saved start-minimized preference');
      assert.equal(companion.getSnapshot().status, phase === 'restart' ? 'running' : 'stopped');
      invokeTray('show-app'); await until(async () => await execute(`!!document.querySelector('[data-page="home"]')`)); assert.equal(await execute(`!!document.querySelector('[data-onboarding-step]')`), false);
      if (phase === 'restart') { await flow.action('pause'); assert.equal(flow.getSnapshot().settings.companionEnabled, false); }
    }
    const blocked = await execute(`fetch('https://example.invalid/anime-cursor-offline-check').then(() => false, () => true)`); assert.equal(blocked, true);
    const isolation = await execute(`({ node: typeof require, process: typeof process })`); assert.deepEqual(isolation, { node: 'undefined', process: 'undefined' });
    const saved = flow.getSnapshot().settings;
    app.once('will-quit', () => {
      try {
        assert.equal(companion.getSnapshot().status, 'stopped'); assert.equal(cursor.getSnapshot().status, 'stopped'); assert.equal(engine.manager.getCurrentState(), 'normal'); assert.equal(tray.isCreated(), false);
        const result = { passed: true, phase, settings: saved, offline: true, closeToTray: true, trayCallbacks: true, quitCleanup: true };
        writeFileSync(`dist/validation/flow-${phase}-result.json`, JSON.stringify(result, null, 2)); console.info(`[flow-check] RESULT ${JSON.stringify(result)}`);
      } catch (error) { console.error('[flow-check] Quit cleanup failed', error); app.exit(1); }
    });
    invokeTray('quit');
  } catch (error) { console.error('[flow-check] FAILED', error); console.error(await execute(`({ inputs: Array.from(document.querySelectorAll('input')).map(i => ({ field: i.dataset.preference, value: i.value, disabled: i.disabled })), text: document.body.textContent })`)); await capture('failure'); companion.dispose(); cursor.dispose(); tray.dispose(); flow.dispose(); app.exit(1); }
}
