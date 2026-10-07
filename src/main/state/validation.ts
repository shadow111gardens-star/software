import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CharacterManager } from '../../services/characters/character-manager';
import type { CompanionController } from '../../services/companion/companion-controller';
import type { CursorStateEngine } from '../../services/state/cursor-state-engine';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import { validateNativeClassification } from './native-classification-validation';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, timeout = 10000): Promise<void> { const end = Date.now() + timeout; while (!check()) { if (Date.now() > end) throw new Error('State validation timed out'); await delay(25); } }
export async function validateStates(main: BrowserWindow, companion: CompanionController, engine: CursorStateEngine, cursor: CursorTrackingService, characters: CharacterManager, live: boolean): Promise<void> {
  let code = 0;
  try {
    await companion.start(); assert.equal(companion.getSnapshot().status, 'running');
    const windows = BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion'); assert.equal(windows.length, 1); const overlay = windows[0]; const id = overlay.id;
    if (process.platform === 'win32') {
      await until(() => !['windows-starting', 'initial'].includes(engine.manager.getSnapshot().context?.semantic.source ?? 'initial'));
      const native = engine.manager.getSnapshot().context?.semantic;
      assert.equal(native?.error, null, 'Read-only Windows native helper starts successfully');
      console.info(`[state-check] native ${JSON.stringify(native)}`);
    }
    const active = characters.getActiveCharacter(); assert.ok(active);
    const choices = await main.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[aria-label="Development state diagnostics"] select option')).map(option => option.value)`);
    if (choices.length) assert.deepEqual(choices, ['AUTO', ...CURSOR_STATES], 'Mounted development panel exposes only authoritative states');
    await mkdir('dist/validation/states', { recursive: true });
    const checks = [];
    for (const state of CURSOR_STATES) {
      await main.webContents.executeJavaScript(`window.animeCursor.state.setOverride(${JSON.stringify(state)})`);
      await until(() => companion.getSnapshot().state === state);
      const asset = await characters.getStateAsset(active.id, state); assert.ok(asset && !asset.fallback);
      const rendered = await overlay.webContents.executeJavaScript(`({ state: document.body.dataset.state, src: document.querySelector('img').src, width: document.querySelector('img').naturalWidth, height: document.querySelector('img').naturalHeight, node: typeof require, mainAPI: typeof window.animeCursor })`);
      assert.equal(rendered.state, state); assert.equal(rendered.src, asset.dataUrl); assert.ok(rendered.width > 0 && rendered.height > 0);
      assert.equal(rendered.node, 'undefined'); assert.equal(rendered.mainAPI, 'undefined');
      assert.equal(overlay.id, id); assert.equal(overlay.isDestroyed(), false); assert.equal(overlay.isFocusable(), false); assert.equal(overlay.isFocused(), false); assert.equal(overlay.isAlwaysOnTop(), true);
      assert.equal(BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion').length, 1);
      await delay(60); const image = await overlay.webContents.capturePage(); assert.equal(image.toBitmap()[3], 0); await writeFile(`dist/validation/states/${state}.png`, image.toPNG());
      checks.push({ state, width: rendered.width, height: rendered.height, windowId: overlay.id });
    }
    const invalidRejected = await main.webContents.executeJavaScript(`window.animeCursor.state.setOverride('seventeenth').then(() => false, () => true)`); assert.equal(invalidRejected, true);
    await main.webContents.executeJavaScript('window.animeCursor.state.setOverride(null)');
    assert.equal(engine.manager.getSnapshot().override, null);
    const nativeClassification = await validateNativeClassification(main, overlay, engine, companion, characters);
    const observed = new Set<string>(); const remove = engine.manager.subscribe(state => { const snapshot = engine.manager.getSnapshot(); if (snapshot.override === null) { observed.add(state); console.info(`[state-check] AUTO ${state} (${snapshot.source})`); } });
    try {
      if (live) {
        console.info('[state-check] AUTO active for 60 seconds. Try text, links, window edges, desktop and application switches.');
        const log = setInterval(() => console.info(`[state-check] ${JSON.stringify({ state: engine.manager.getSnapshot(), companion: companion.getSnapshot(), focused: main.isFocused() })}`), 5000);
        try { await delay(60000); } finally { clearInterval(log); }
      }
    } finally { remove(); }
    // A tester may use the development selector during the live run; finish explicitly in AUTO.
    await main.webContents.executeJavaScript('window.animeCursor.state.setOverride(null)');
    await until(() => companion.getSnapshot().state === engine.manager.getCurrentState());
    let nativeFlags: unknown = null;
    if (process.platform === 'win32') {
      const handle = overlay.getNativeWindowHandle().readBigUInt64LE().toString();
      const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class StateWindowFlags { [DllImport("user32.dll", EntryPoint="GetWindowLongW")] public static extern int Read(IntPtr window, int index); }'; $style = [StateWindowFlags]::Read([IntPtr]::new([Int64]${handle}), -20); @{ clickThrough = (($style -band 0x20) -ne 0); noActivate = (($style -band 0x08000000) -ne 0); layered = (($style -band 0x80000) -ne 0) } | ConvertTo-Json -Compress`;
      const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      const flags = JSON.parse(stdout); assert.equal(flags.clickThrough, true); assert.equal(flags.noActivate, true); assert.equal(flags.layered, true); nativeFlags = flags;
    }
    const automatic = engine.manager.getSnapshot();
    companion.stop(); assert.equal(overlay.isDestroyed(), true); assert.equal(engine.manager.getCurrentState(), 'extra'); assert.equal(engine.manager.getSnapshot().override, null);
    await companion.start(); assert.equal(companion.getSnapshot().status, 'running'); companion.stop();
    assert.equal(BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion').length, 0);
    const result = { passed: true, checks, nativeClassification, nativeFlags, automatic, observedAutomaticStates: [...observed], cleanup: true };
    await writeFile('dist/validation/state-result.json', JSON.stringify(result, null, 2)); console.info(`[state-check] RESULT ${JSON.stringify(result)}`);
  } catch (error) { console.error('[state-check] FAILED', error); code = 1; }
  finally { companion.dispose(); cursor.dispose(); app.exit(code); }
}
