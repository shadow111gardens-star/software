import { validateStore } from './store-validation';
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
  const click = async (label: string, scope = 'document') => { await until(async () => await execute(`Array.from(${scope}.querySelectorAll('button')).some(value => (value.textContent.trim() === ${JSON.stringify(label)} || value.getAttribute("aria-label") === ${JSON.stringify(label)}) && !value.disabled)`)); await execute(`(() => { const button = Array.from(${scope}.querySelectorAll('button')).find(value => (value.textContent.trim() === ${JSON.stringify(label)} || value.getAttribute("aria-label") === ${JSON.stringify(label)})); if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(label)}); button.click(); })()`); await delay(50); };
  const page = async (value: string) => { await until(async () => await execute(`!!document.querySelector('[data-page="${value}"]') && !document.querySelector('[data-page="${value}"]').disabled`)); await execute(`document.querySelector('[data-page="${value}"]').click()`); await until(async () => await execute(`document.querySelector('main[data-current-page]')?.dataset.currentPage === '${value}'`)); };
  const number = async (field: string, value: number) => {
    const selector = `[data-preference="${field}"]`;
    await until(async () => await execute(`!!document.querySelector('${selector}') && !document.querySelector('${selector}').disabled`));
    await delay(100);
    await execute(`(() => { const input = document.querySelector('${selector}'); input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${value}'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await delay(100);
    await execute(`(() => { const input = document.querySelector('${selector}'); input.blur(); input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); })()`);
  };
  const invokeTray = (id: string) => { const entry = item(tray.getMenu(), id); assert.ok(entry && entry.enabled, `Tray action ${id}`); entry.click(entry, main, {} as Electron.KeyboardEvent); };
  const capture = async (name: string) => { await delay(300); await writeFile(`dist/validation/flow-${name}.png`, (await main.webContents.capturePage(await execute('({ x: 0, y: 0, width: innerWidth, height: innerHeight })'))).toPNG()); };
  try {
    await mkdir('dist/validation', { recursive: true });
    await until(async () => await execute(`!!document.querySelector('[data-app-ready]')`));
    assert.equal(tray.isCreated(), true);
    if (phase === 'store-empty') {
      invokeTray('show-app'); await page('store');
      await click('Installed', `document.querySelector('[aria-label="Store filters"]')`);
      assert.equal(await execute(`document.querySelector('.empty-state h2').textContent`), 'No installed characters yet.');
      assert.equal(await execute(`document.querySelectorAll('.store-grid [data-product]').length`), 0);
      assert.equal(flow.getSnapshot().settings.activeCharacterId, null);
      await capture('store-empty');
    } else if (phase === 'onboarding') {
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, false);
      await click('Get Started'); await click('Continue'); await click('Start Companion');
      await until(async () => await execute(`!!document.querySelector('main[data-current-page="home"]')`));
      assert.equal(flow.getSnapshot().settings.activeCharacterId, 'aiko');
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, true);
      await until(() => companion.getSnapshot().status === 'running');
    } else if (phase === 'onboarding-restart') {
      await until(async () => await execute(`!!document.querySelector('main[data-current-page="home"]')`));
      assert.equal(await execute(`!!document.querySelector('[data-onboarding-step]')`), false);
      assert.equal(flow.getSnapshot().settings.activeCharacterId, 'aiko');
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, true);
      await until(() => companion.getSnapshot().status === 'running');
      // Finish this isolated relaunch by exercising persistent Skip from the last screen.
      await page('settings'); await click('Restart Setup'); await click('Get Started'); await click('Continue'); await click('Skip Setup');
      await until(async () => await execute(`!!document.querySelector('main[data-current-page="home"]')`));
    } else if (phase === 'first') {
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, true, 'Skip persists across an Electron restart');
      assert.equal(flow.getSnapshot().settings.activeCharacterId, 'aiko');
      await flow.restartOnboarding();
      await until(async () => await execute(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep === '1'`));
      assert.equal(flow.getSnapshot().settings.onboardingCompleted, false); assert.equal(companion.getSnapshot().status, 'stopped');
      await capture('welcome'); await click('Get Started'); await until(async () => await execute(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep === '2'`));
      assert.equal(await execute(`!!document.querySelector('[data-product="aiko"]')`), true); await capture('choose');
      await click('Back'); await until(async () => await execute(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep === '1'`)); await click('Get Started');
      await click('Continue'); await capture('all-set'); await click('Back'); await click('Continue');
      const setupBounds = main.getBounds();
      for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080]]) {
        main.setContentSize(width, height); await delay(100);
        let requestedWidth = width; let requestedHeight = height;
        for (let attempt = 0; attempt < 4; attempt++) {
          const actual = await execute('({ width: innerWidth, height: innerHeight })');
          if (actual.width === width && actual.height === height) break;
          requestedWidth += width - actual.width; requestedHeight += height - actual.height;
          main.setContentSize(requestedWidth, requestedHeight); await delay(100);
        }
        await click('Back'); await click('Back');
        const sameBounds = JSON.stringify(main.getBounds());
        for (const step of [1, 2, 3]) {
          if (step === 2) await click('Get Started');
          if (step === 3) await click('Continue');
          assert.equal(JSON.stringify(main.getBounds()), sameBounds, 'All three steps keep the same native frame');
          const layout = await execute(`(() => { const frame = document.querySelector('.setup-screen'); const action = Array.from(frame.querySelectorAll('.setup-primary')).find(b => !b.disabled); const rect = action?.getBoundingClientRect(); return { overflow: frame.scrollWidth > frame.clientWidth, buttonVisible: !!rect && rect.bottom <= innerHeight && rect.top >= 0, artwork: Array.from(frame.querySelectorAll('img')).every(img => { const r = img.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }) }; })()`);
          assert.equal(layout.overflow, false); assert.equal(layout.buttonVisible, true); assert.equal(layout.artwork, true);
          await capture(`onboarding-${step}-${width}`);
        }
      }
      main.setBounds(setupBounds);
      await click('Start Companion'); await until(() => flow.getSnapshot().settings.onboardingCompleted && companion.getSnapshot().status === 'running');
      await until(async () => await execute(`!!document.querySelector('[data-page="home"]')`));
      assert.equal(flow.getSnapshot().settings.activeCharacterId, 'aiko');
      for (const skipStep of [1, 2, 3]) {
        await page('settings'); await click('Restart Setup');
        await until(async () => await execute(`document.querySelector('[data-onboarding-step]')?.dataset.onboardingStep === '1'`));
        assert.equal(flow.getSnapshot().settings.onboardingCompleted, false); assert.equal(companion.getSnapshot().status, 'stopped');
        if (skipStep >= 2) await click('Get Started');
        if (skipStep === 3) await click('Continue');
        await click('Skip Setup');
        await until(async () => await execute(`!!document.querySelector('main[data-current-page="home"]')`));
        assert.equal(flow.getSnapshot().settings.onboardingCompleted, true);
        assert.equal(flow.getSnapshot().settings.activeCharacterId, 'aiko');
        await until(() => companion.getSnapshot().status === 'running');
      }
      assert.equal(flow.getSnapshot().settings.companionEnabled, true); await capture('home');
      await click('Hide Companion'); await until(() => flow.getSnapshot().status === 'Hidden'); assert.equal(flow.getSnapshot().settings.companionEnabled, true);
      await click('Show Companion'); await until(() => flow.getSnapshot().status === 'Active');
      await click('Pause Companion'); await until(() => flow.getSnapshot().status === 'Paused'); assert.equal(flow.getSnapshot().settings.companionEnabled, false);
      await click('Resume Companion'); await until(() => flow.getSnapshot().status === 'Active');
      engine.manager.setOverride('text'); await until(() => companion.getSnapshot().state === 'text');
      assert.equal(await execute(`!!document.querySelector('[data-page="characters"]')`), false);
      await click('Change Character'); await capture('picker');
      await execute(`document.querySelector('[data-product="test-future"] [data-action="activate"]').click()`);
      await until(() => flow.getSnapshot().settings.activeCharacterId === 'test-future' && companion.getSnapshot().characterId === 'test-future'); assert.equal(companion.getSnapshot().state, 'text');
      await click('Close', `document.querySelector('dialog')`);
      engine.manager.setOverride(null);
      await page('settings'); await until(async () => await execute(`document.querySelectorAll('[aria-label="Development state diagnostics"] select option').length === 17`));
      await execute(`(() => { const input = document.querySelector('#size-slider'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '140'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await delay(40); await execute(`document.querySelector('#size-slider').dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))`);
      await until(() => flow.getSnapshot().settings.characterSize === 140);
      await until(async () => await execute(`document.querySelector('[data-preference="size"]').value === '140' && !document.querySelector('[data-preference="size"]').disabled`));
      await number('size', 132); await until(() => flow.getSnapshot().settings.characterSize === 132);
      await until(async () => await execute(`!document.querySelector('[data-preference="start-minimized"]').disabled`));
      await execute(`document.querySelector('[data-preference="start-minimized"]').click()`);
      await until(() => flow.getSnapshot().settings.startMinimized);
      await number('offset-x', 38); await until(() => flow.getSnapshot().settings.cursorOffset.x === 38);
      await number('opacity', 65); await until(() => flow.getSnapshot().settings.opacity === .65);
      await number('smoothing', 20); await until(() => flow.getSnapshot().settings.smoothing === .2);
      assert.equal(Math.max(companion.getSnapshot().bounds!.width, companion.getSnapshot().bounds!.height), 136);
      await capture('settings'); await page('store');
      await validateStore(main, flow);
      await page('home');
      const layouts = []; const originalBounds = main.getBounds();
      main.setContentSize(1200, 760); await delay(100);
      for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080]]) {
        main.setContentSize(width, height); await delay(100);
        // Windows fractional DPI can round a frameless native client area by 1-2 DIP.
        let requestedWidth = width; let requestedHeight = height;
        for (let attempt = 0; attempt < 4; attempt++) {
          const actual = await execute('({ width: innerWidth, height: innerHeight })');
          if (actual.width === width && actual.height === height) break;
          requestedWidth += width - actual.width; requestedHeight += height - actual.height;
          main.setContentSize(requestedWidth, requestedHeight); await delay(100);
        }
        await until(async () => await execute(`innerWidth === ${width} && innerHeight === ${height}`));
        for (const view of ['home', 'settings', 'store']) {
          await page(view);
          if (view === 'store') await click('Explore All');
          await delay(80); const overflow = await execute('document.documentElement.scrollWidth > window.innerWidth || document.querySelector("main[data-current-page]").scrollWidth > document.querySelector("main[data-current-page]").clientWidth'); assert.equal(overflow, false, `No horizontal overflow at ${width} on ${view}`); layouts.push({ width, height, view, overflow }); await capture(`${view}-${width}`);
        }
      }
      main.setBounds(originalBounds);
      await execute('window.animeCursor.close()'); await until(() => !main.isVisible()); assert.equal(main.isDestroyed(), false); assert.equal(companion.getSnapshot().status, 'running');
      invokeTray('settings'); await until(() => main.isVisible()); await until(async () => await execute(`document.querySelector('[data-current-page]')?.dataset.currentPage === 'settings'`));
      invokeTray('hide-app'); assert.equal(main.isVisible(), false); invokeTray('show-app'); assert.equal(main.isVisible(), true);
      invokeTray('hide-companion'); await until(() => flow.getSnapshot().status === 'Hidden'); invokeTray('show-companion'); await until(() => flow.getSnapshot().status === 'Active');
      invokeTray('pause-companion'); await until(() => flow.getSnapshot().status === 'Paused'); invokeTray('resume-companion'); await until(() => flow.getSnapshot().status === 'Active');
      invokeTray('character-aiko'); await until(() => flow.getSnapshot().settings.activeCharacterId === 'aiko'); invokeTray('character-test-future'); await until(() => flow.getSnapshot().settings.activeCharacterId === 'test-future');
      invokeTray('open-store'); await until(async () => await execute(`document.querySelector('[data-current-page]')?.dataset.currentPage === 'store'`));
      await flow.activate('aiko');
      await flow.action('hide');
      await flow.preferences({ startMinimized: true, startCompanionAutomatically: true });
      console.info(`[flow-check] layouts ${JSON.stringify(layouts)}`);
    } else {
      const snapshot = flow.getSnapshot(); assert.equal(snapshot.settings.onboardingCompleted, true); assert.equal(snapshot.settings.activeCharacterId, 'aiko'); assert.equal(snapshot.settings.companionVisible, false); assert.equal(snapshot.settings.companionPaused, phase === 'paused'); assert.equal(snapshot.settings.characterSize, 132); assert.equal(snapshot.settings.opacity, .65); assert.equal(snapshot.settings.cursorOffset.x, 38); assert.equal(snapshot.settings.smoothing, .2);
      assert.equal(main.isVisible(), false, 'Saved start-minimized preference');
      assert.equal(companion.getSnapshot().status, phase === 'restart' ? 'hidden' : 'stopped');
      invokeTray('show-app'); await until(async () => await execute(`!!document.querySelector('[data-page="home"]')`)); assert.equal(await execute(`!!document.querySelector('[data-onboarding-step]')`), false);
      if (phase === 'restart') { await flow.action('pause'); assert.equal(flow.getSnapshot().settings.companionEnabled, false); }
      else { await flow.action('resume'); assert.equal(companion.getSnapshot().status, 'hidden'); await flow.action('show'); assert.equal(companion.getSnapshot().status, 'running'); assert.equal(flow.getSnapshot().settings.companionVisible, true); await flow.action('pause'); }
    }
    const blocked = await execute(`fetch('https://example.invalid/anime-cursor-offline-check').then(() => false, () => true)`); assert.equal(blocked, true);
    const isolation = await execute(`({ node: typeof require, process: typeof process })`); assert.deepEqual(isolation, { node: 'undefined', process: 'undefined' });
    const saved = flow.getSnapshot().settings;
    app.once('will-quit', () => {
      try {
        assert.equal(companion.getSnapshot().status, 'stopped'); assert.equal(cursor.getSnapshot().status, 'stopped'); assert.equal(engine.manager.getCurrentState(), 'extra'); assert.equal(tray.isCreated(), false);
        const result = { passed: true, phase, settings: saved, offline: true, closeToTray: true, trayCallbacks: true, quitCleanup: true };
        writeFileSync(`dist/validation/flow-${phase}-result.json`, JSON.stringify(result, null, 2)); console.info(`[flow-check] RESULT ${JSON.stringify(result)}`);
      } catch (error) { console.error('[flow-check] Quit cleanup failed', error); app.exit(1); }
    });
    invokeTray('quit');
  } catch (error) { console.error('[flow-check] FAILED', error); console.error(await execute(`({ inputs: Array.from(document.querySelectorAll('input')).map(i => ({ field: i.dataset.preference, value: i.value, disabled: i.disabled })), text: document.body.textContent })`)); await capture('failure'); companion.dispose(); cursor.dispose(); tray.dispose(); flow.dispose(); app.exit(1); }
}
