import { screen, type BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CursorStateEngine } from '../../services/state/cursor-state-engine';
import type { CompanionController } from '../../services/companion/companion-controller';
import type { CharacterManager } from '../../services/characters/character-manager';
import type { CursorState } from '../../shared/constants/cursor-states';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 10000;
  while (!check()) { if (Date.now() > end) throw new Error('Native cursor classification timed out'); await delay(25); }
}
async function movePointer(x: number, y: number): Promise<void> {
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class CursorFixturePointer { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); }'; if (-not [CursorFixturePointer]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})) { throw 'SetCursorPos failed' }`;
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
}
export async function validateNativeClassification(main: BrowserWindow, overlay: BrowserWindow, engine: CursorStateEngine, companion: CompanionController, characters: CharacterManager) {
  if (process.platform !== 'win32') return { tested: false, reason: 'Windows native fixture only' };
  const originalPointer = screen.getCursorScreenPoint();
  const pack = characters.getActiveCharacter(); assert.ok(pack);
  const customSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="#ff35b0" stroke="#000" d="M2 2L22 12L12 15L8 22Z"/></svg>';
  const custom = 'url("data:image/svg+xml;base64,' + Buffer.from(customSvg).toString('base64') + '") 2 2, auto';
  const cases: Array<{ css: string; state: CursorState }> = [
    { css: 'default', state: 'normal' }, { css: 'text', state: 'text' },
    { css: 'help', state: 'help' }, { css: 'pointer', state: 'link' },
    { css: 'crosshair', state: 'precision' }, { css: custom, state: 'extra' },
    { css: 'move', state: 'move' }, { css: 'ew-resize', state: 'horizontal' },
    { css: 'ns-resize', state: 'vertical' }, { css: 'nwse-resize', state: 'diagonal' },
    { css: 'nesw-resize', state: 'diagonalSecondary' }, { css: 'wait', state: 'busy' },
    { css: 'progress', state: 'working' }, { css: 'not-allowed', state: 'unavailable' },
    { css: 'default', state: 'normal' },
  ];
  const checks = [];
  main.show(); main.focus();
  await main.webContents.executeJavaScript(`(() => { const fixture = document.createElement('div'); fixture.id = 'native-cursor-fixture'; Object.assign(fixture.style, {position:'fixed',inset:'60px 20px 20px',zIndex:'999999',background:'#182038'}); fixture.textContent='Native cursor classification check'; document.body.appendChild(fixture); })()`);
  try {
    for (const [index, test] of cases.entries()) {
      await main.webContents.executeJavaScript(`document.querySelector('#native-cursor-fixture').style.cursor = ${JSON.stringify(test.css)}`);
      const bounds = main.getContentBounds();
      const point = screen.dipToScreenPoint({ x: bounds.x + 100 + index * 3, y: bounds.y + 120 });
      await movePointer(point.x, point.y);
      await until(() => engine.manager.getSnapshot().override === null && engine.manager.getCurrentState() === test.state && companion.getSnapshot().state === test.state);
      const snapshot = engine.manager.getSnapshot();
      assert.equal(snapshot.detectedState, test.state);
      if (test.state === 'extra') {
        assert.equal(snapshot.context?.semantic.reliable, false);
        assert.equal(snapshot.reason, 'unrecognized/unsupported cursor');
      } else {
        assert.equal(snapshot.context?.semantic.reliable, true);
        assert.equal(snapshot.reason, 'recognized OS cursor');
      }
      const asset = await characters.getStateAsset(pack.id, test.state); assert.ok(asset && !asset.fallback);
      const rendered = await overlay.webContents.executeJavaScript(`({ state: document.body.dataset.state, src: document.querySelector('img').src })`);
      assert.equal(rendered.state, test.state); assert.equal(rendered.src, asset.dataUrl);
      checks.push({ cursor: test.state === 'extra' ? 'custom SVG cursor' : test.css, state: test.state, reason: snapshot.reason, nativeSource: snapshot.context?.semantic.source, assetVerified: true });
    }
    return { tested: true, checks };
  } finally {
    await main.webContents.executeJavaScript("document.querySelector('#native-cursor-fixture')?.remove()");
    const point = screen.dipToScreenPoint(originalPointer);
    await movePointer(point.x, point.y);
  }
}

