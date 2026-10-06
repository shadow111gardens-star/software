import { app, BrowserWindow, nativeImage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { deflateSync } from 'node:zlib';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import { CharacterPackLoader } from './character-pack-loader';
import { CharacterManager } from './character-manager';
import { LocalSettingsStore } from '../storage/settings-store';
import { registerCharacterIPC } from '../../main/characters/ipc';
// A technical 1px fixture with correct PNG CRCs, not character artwork.
function crc(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, bytes: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), bytes]);
  const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(body));
  return Buffer.concat([size, body, checksum]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0,255,255,255,255]))), chunk('IEND', Buffer.alloc(0))]);
const timeout = setTimeout(() => { console.error('Electron character test timed out'); app.exit(1); }, 20000);
void app.whenReady().then(async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'anime-cursor-electron-tests-'));
  let window: BrowserWindow | undefined;
  let code = 0;
  try {
    const directory = join(temporary, 'packs', 'technical-fixture'); await mkdir(directory, { recursive: true });
    const states = Object.fromEntries(CURSOR_STATES.map(state => [state, `${state}.png`]));
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({ id: 'technical-fixture', name: 'Technical test fixture', version: '1.0.0', platforms: ['windows', 'macos'], states }));
    for (const path of Object.values(states)) await writeFile(join(directory, path), png);
    const validateImage = (bytes: Buffer) => !nativeImage.createFromBuffer(bytes).isEmpty();
    const manager = new CharacterManager(new CharacterPackLoader(join(temporary, 'packs'), 'windows', validateImage), new LocalSettingsStore(join(temporary, 'settings')), validateImage);
    await manager.initialize(); assert.equal(manager.getCharacters().length, 1);
    window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: resolve('dist/electron/preload.cjs') } });
    registerCharacterIPC(manager, event => { assert.equal(event.sender, window!.webContents); assert.equal(event.senderFrame, window!.webContents.mainFrame); });
    const html = join(temporary, 'test.html');
    await writeFile(html, '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:"><title>Technical asset bridge test</title>');
    await window.loadFile(html);
    const assets = await window.webContents.executeJavaScript(`(async () => {
      const catalog = await window.animeCursor.characters.getCharacters();
      const results = [];
      for (const state of ${JSON.stringify(CURSOR_STATES)}) {
        const asset = await window.animeCursor.characters.getStateAsset('technical-fixture', state);
        const image = new Image(); image.src = asset.dataUrl; await image.decode();
        results.push({ requested: state, resolved: asset.resolvedState, width: image.naturalWidth, fallback: asset.fallback });
      }
      return { active: catalog.activeCharacterId, results, node: typeof require, process: typeof process };
    })()`);
    assert.equal(assets.active, 'technical-fixture'); assert.equal(assets.results.length, 16);
    for (const asset of assets.results) { assert.equal(asset.requested, asset.resolved); assert.equal(asset.width, 1); assert.equal(asset.fallback, false); }
    assert.equal(assets.node, 'undefined'); assert.equal(assets.process, 'undefined');
    await rm(join(directory, states.help));
    assert.equal((await manager.getStateAsset('technical-fixture', 'help'))?.resolvedState, 'normal');
    console.log('PASS: Electron native decoder, all 16 IPC data URLs decoded in sandboxed renderer, active selection, runtime normal fallback');
  } catch (error) { console.error(error); code = 1; }
  finally {
    window?.destroy();
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test directory');
    await rm(temporary, { recursive: true, force: true });
    clearTimeout(timeout); app.exit(code);
  }
}).catch(error => { console.error(error); app.exit(1); });
