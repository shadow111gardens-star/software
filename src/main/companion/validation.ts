import { app, BrowserWindow, screen } from 'electron';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CompanionController } from '../../services/companion/companion-controller';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import { isCursorState } from '../../shared/constants/cursor-states';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const overlayWindow = () => {
  const windows = BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion');
  assert.equal(windows.length, 1, 'Exactly one overlay window'); return windows[0];
};
export async function validateOverlay(main: BrowserWindow, companion: CompanionController, cursor: CursorTrackingService, live: boolean): Promise<void> {
  let code = 0;
  const started = Date.now(); const cpu = process.cpuUsage();
  try {
    assert.equal(companion.getSnapshot().status, 'stopped');
    const [first, second] = await Promise.all([companion.start(), companion.start()]);
    assert.equal(first.status, 'running'); assert.equal(second.status, 'running');
    const overlay = overlayWindow(); await delay(200);
    assert.equal(overlay.isVisible(), true); assert.equal(overlay.isFocusable(), false); assert.equal(overlay.isFocused(), false);
    assert.equal(overlay.isAlwaysOnTop(), true); assert.equal(overlay.isResizable(), false); assert.equal(overlay.hasShadow(), false);
    assert.ok(['#000000', '#00000000'].includes(overlay.getBackgroundColor()));
    const renderer = await overlay.webContents.executeJavaScript(`({ ready: document.body.dataset.ready, characterId: document.body.dataset.characterId, state: document.body.dataset.state, background: getComputedStyle(document.body).backgroundColor, node: typeof require, process: typeof process, mainAPI: typeof window.animeCursor, width: document.querySelector('img').naturalWidth, height: document.querySelector('img').naturalHeight, overflow: getComputedStyle(document.body).overflow })`);
    assert.equal(renderer.ready, 'true'); assert.equal(isCursorState(renderer.state), true); assert.equal(renderer.characterId, first.characterId);
    assert.equal(renderer.node, 'undefined'); assert.equal(renderer.process, 'undefined'); assert.equal(renderer.mainAPI, 'undefined'); assert.equal(renderer.background, 'rgba(0, 0, 0, 0)'); assert.equal(renderer.overflow, 'hidden');
    const image = await overlay.webContents.capturePage();
    const bitmap = image.toBitmap(); assert.equal(bitmap[3], 0, 'Transparent capture corner');
    assert.ok(bitmap.some((value, index) => index % 4 === 3 && value > 0), 'Visible artwork pixels');
    await mkdir('dist/validation', { recursive: true }); await writeFile(join('dist/validation', 'overlay.png'), image.toPNG());
    let nativeFlags: unknown = null;
    if (process.platform === 'win32') {
      const handle = overlay.getNativeWindowHandle().readBigUInt64LE().toString();
      const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class OverlayWindowCheck { [DllImport("user32.dll", EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr window, int index); }'; $style = [OverlayWindowCheck]::GetWindowLong([IntPtr]::new([Int64]${handle}), -20); @{ clickThrough = (($style -band 0x20) -ne 0); noActivate = (($style -band 0x08000000) -ne 0); layered = (($style -band 0x80000) -ne 0) } | ConvertTo-Json -Compress`;
      const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      nativeFlags = JSON.parse(stdout); const flags = nativeFlags as { clickThrough: boolean; noActivate: boolean; layered: boolean };
      assert.equal(flags.clickThrough, true); assert.equal(flags.noActivate, true); assert.equal(flags.layered, true);
    }
    const hidden = companion.hide(); assert.equal(hidden.visible, false); assert.equal(overlay.isVisible(), false);
    companion.show(); assert.equal(overlay.isVisible(), true);
    main.hide(); await delay(50); assert.equal(overlay.isVisible(), true); assert.equal(companion.getSnapshot().status, 'running'); main.show();
    const metadata = { renderer, nativeFlags, displays: screen.getAllDisplays().map(display => ({ id: String(display.id), bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor })), bounds: companion.getSnapshot().bounds };
    console.info(`[overlay-check] initial ${JSON.stringify(metadata)}`);
    let movementUpdates = 0; let unfocusedUpdates = 0;
    const remove = cursor.subscribe(() => { movementUpdates++; if (!main.isFocused()) unfocusedUpdates++; });
    try {
      if (live) {
        console.info('[overlay-check] Aiko is now following the real cursor. Test clicking, dragging, selecting and scrolling through it for 60 seconds.');
        const timer = setInterval(() => console.info(`[overlay-check] ${JSON.stringify({ focused: main.isFocused(), ...companion.getSnapshot(), cursor: cursor.getCurrentPosition() })}`), 5000);
        try { await delay(60000); } finally { clearInterval(timer); }
      }
    } finally { remove(); }
    companion.stop(); assert.equal(overlay.isDestroyed(), true);
    const frozen = companion.getSnapshot(); await delay(50); assert.deepEqual(companion.getSnapshot(), frozen);
    await companion.start(); assert.equal(overlayWindow().isVisible(), true); assert.equal(BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion').length, 1);
    const restarted = overlayWindow();
    // Close the main window without terminating the independently running overlay.
    main.close(); await delay(50); assert.equal(restarted.isDestroyed(), false); assert.equal(companion.getSnapshot().status, 'running');
    restarted.webContents.forcefullyCrashRenderer(); await delay(100);
    assert.equal(companion.getSnapshot().status, 'error'); assert.equal(restarted.isDestroyed(), true);
    await companion.start(); assert.equal(companion.getSnapshot().status, 'running');
    companion.dispose(); cursor.dispose();
    assert.equal(BrowserWindow.getAllWindows().filter(window => window.getTitle() === 'Anime Cursor Companion').length, 0);
    assert.equal(cursor.getSnapshot().status, 'stopped');
    const usage = process.cpuUsage(cpu);
    const result = { passed: true, ...metadata, movementUpdates, unfocusedUpdates, elapsedMs: Date.now() - started, cpuMilliseconds: (usage.user + usage.system) / 1000, cleanup: true };
    await writeFile('dist/validation/overlay-result.json', JSON.stringify(result, null, 2)); console.info(`[overlay-check] RESULT ${JSON.stringify(result)}`);
  } catch (error) { console.error('[overlay-check] FAILED', error); code = 1; }
  finally { companion.dispose(); cursor.dispose(); app.exit(code); }
}
