import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import type { CharacterPack } from '../../shared/types/character';
import { validateManifest } from './manifest';
import { CharacterPackLoader } from './character-pack-loader';
import { CharacterManager } from './character-manager';
import { LocalSettingsStore } from '../storage/settings-store';
import { defaultSettings } from '../../shared/constants/settings';
import { readBoundedFile } from './assets';
// A one-pixel PNG for temporary filesystem tests; never shipped as character artwork.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTioAAAAASUVORK5CYII=', 'base64');
const validateImage = (bytes: Buffer) => bytes.equals(png);
function manifest(id = 'fixture-primary'): CharacterPack {
  return { id, name: id, version: '1.0.0', platforms: ['windows', 'macos'], states: Object.fromEntries(CURSOR_STATES.map(state => [state, `original-${state}.png`])) as CharacterPack['states'], metadata: { fixture: true } };
}
async function fixture(run: (root: string, packs: string, logs: string[]) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'anime-cursor-character-tests-'));
  try { const packs = join(root, 'packs'); await mkdir(packs); await run(root, packs, []); }
  finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    await rm(root, { recursive: true, force: true });
  }
}
async function addPack(packs: string, pack = manifest(), folder = pack.id) {
  const directory = join(packs, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(pack));
  for (const path of Object.values(pack.states)) { const file = join(directory, path); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, png); }
  return directory;
}
function manager(root: string, packs: string, logs: string[]) {
  const log = (message: string) => logs.push(message);
  const storage = new LocalSettingsStore(join(root, 'settings'), log);
  return new CharacterManager(new CharacterPackLoader(packs, 'windows', validateImage, log), storage, validateImage, 'fixture-primary', log);
}
test('exact 16 states; both diagonal states remain distinct', () => {
  assert.equal(CURSOR_STATES.length, 16);
  assert.equal(new Set(CURSOR_STATES).size, 16);
  assert.ok(CURSOR_STATES.includes('diagonal') && CURSOR_STATES.includes('diagonalSecondary'));
  const result = validateManifest(manifest()); assert.equal(result.valid, true);
  if (result.valid) assert.notEqual(result.pack.states.diagonal, result.pack.states.diagonalSecondary);
});
test('manifest rejects missing, extra and duplicate state mappings', () => {
  const missing = manifest(); delete (missing.states as Partial<CharacterPack['states']>).help;
  assert.equal(validateManifest(missing).valid, false);
  assert.equal(validateManifest({ ...manifest(), states: { ...manifest().states, invented: 'invented.png' } }).valid, false);
  const duplicate = manifest(); duplicate.states.help = duplicate.states.normal;
  assert.equal(validateManifest(duplicate).valid, false);
});
test('manifest validates identity, semver, metadata, platforms and local paths', () => {
  for (const patch of [{ id: '../bad' }, { name: ' ' }, { version: '01.0.0' }, { version: '1.0.0-01' }, { platforms: [] }, { platforms: ['linux'] }, { platforms: ['windows', 'windows'] }, { metadata: [] }, { preview: 'https://host/image.png' }]) assert.equal(validateManifest({ ...manifest(), ...patch }).valid, false);
  assert.equal(validateManifest({ ...manifest(), version: '1.2.3-beta.1+local' }).valid, true);
  for (const path of ['../outside.png', '/outside.png', 'C:/outside.png', 'folder\\image.png', 'image.png?query', 'image%2e.png', 'same/../image.png']) assert.equal(validateManifest({ ...manifest(), states: { ...manifest().states, help: path } }).valid, false);
});
test('discovery loads real files at preserved names; resolves every state', async () => fixture(async (root, packs, logs) => {
  const pack = manifest(); await addPack(packs, pack);
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getCharacters().length, 1); assert.equal(service.hasCharacter(pack.id), true);
  assert.deepEqual(service.getCharacter(pack.id)?.states, pack.states);
  for (const state of CURSOR_STATES) {
    const asset = await service.getStateAsset(pack.id, state);
    assert.equal(asset?.resolvedState, state); assert.equal(asset?.fallback, false);
    assert.equal(asset?.dataUrl, `data:image/png;base64,${png.toString('base64')}`);
  }
  assert.deepEqual(logs.filter(message => !message.startsWith('[storage]')), []);
}));
test('future packs require no manager changes; active selection persists after restart', async () => fixture(async (root, packs, logs) => {
  await addPack(packs); await addPack(packs, manifest('fixture-future'));
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getActiveCharacter()?.id, 'fixture-primary');
  await service.setActiveCharacter('fixture-future');
  const restarted = manager(root, packs, logs); await restarted.initialize();
  assert.equal(restarted.getActiveCharacter()?.id, 'fixture-future');
  await assert.rejects(service.setActiveCharacter('absent'));
  assert.equal(service.getActiveCharacter()?.id, 'fixture-future');
}));
test('missing saved selection falls back deterministically; empty catalog safely clears it', async () => fixture(async (root, packs, logs) => {
  const settings = new LocalSettingsStore(join(root, 'settings'));
  await settings.write({ ...defaultSettings, activeCharacterId: 'removed' });
  await addPack(packs, manifest('z-pack')); await addPack(packs, manifest('b-pack'));
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getActiveCharacter()?.id, 'b-pack');
  await rm(join(packs, 'z-pack'), { recursive: true }); await rm(join(packs, 'b-pack'), { recursive: true });
  await service.initialize(); assert.equal(service.getActiveCharacter(), null);
  assert.equal((await new LocalSettingsStore(join(root, 'settings')).read()).activeCharacterId, null);
}));
test('missing and corrupt runtime state assets log errors and fall back to normal', async () => fixture(async (root, packs, logs) => {
  const directory = await addPack(packs);
  const service = manager(root, packs, logs); await service.initialize();
  await rm(join(directory, manifest().states.help));
  const fallback = await service.getStateAsset('fixture-primary', 'help');
  assert.equal(fallback?.resolvedState, 'normal'); assert.equal(fallback?.fallback, true);
  await writeFile(join(directory, manifest().states.busy), 'corrupt');
  assert.equal((await service.getStateAsset('fixture-primary', 'busy'))?.resolvedState, 'normal');
  await rm(join(directory, manifest().states.normal));
  assert.equal(await service.getStateAsset('fixture-primary', 'help'), null);
  assert.equal(await service.getStateAsset('fixture-primary', 'normal'), null);
  assert.ok(logs.some(log => log.includes('fallback failed')));
}));
test('broken packs and JSON do not prevent valid pack discovery', async () => fixture(async (root, packs, logs) => {
  await addPack(packs);
  const missing = await addPack(packs, manifest('missing')); await rm(join(missing, manifest('missing').states.extra));
  const corrupt = await addPack(packs, manifest('corrupt')); await writeFile(join(corrupt, manifest('corrupt').states.busy), 'bad image');
  const malformed = await addPack(packs, manifest('malformed')); await writeFile(join(malformed, 'manifest.json'), '{invalid');
  const unknown = await addPack(packs, manifest('unknown')); await writeFile(join(unknown, 'manifest.json'), JSON.stringify({ ...manifest('unknown'), states: { ...manifest().states, forbidden: 'extra.png' } }));
  const service = manager(root, packs, logs); await service.initialize();
  assert.deepEqual(service.getCharacters().map(pack => pack.id), ['fixture-primary']);
  assert.equal(service.getCatalog().unavailable.length, 4); assert.ok(logs.length >= 4);
}));
test('duplicate character ids make every conflicting pack unavailable', async () => fixture(async (root, packs, logs) => {
  await addPack(packs, manifest(), 'one'); await addPack(packs, manifest(), 'two');
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getCharacters().length, 0); assert.equal(service.getCatalog().unavailable.length, 2);
}));
test('unsupported platform and broken optional preview are unavailable', async () => fixture(async (_root, packs, logs) => {
  await addPack(packs, { ...manifest('mac-only'), platforms: ['macos'] });
  await addPack(packs, { ...manifest('preview-broken'), preview: 'missing.png' });
  const result = await new CharacterPackLoader(packs, 'windows', validateImage, log => logs.push(log)).discover();
  assert.equal(result.packs.length, 0); assert.equal(result.unavailable.length, 2);
}));
test('symlink pack escape is rejected', async () => fixture(async (root, packs, logs) => {
  const external = await addPack(root, manifest('external'));
  await symlink(external, join(packs, 'escaped'), process.platform === 'win32' ? 'junction' : 'dir');
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.hasCharacter('external'), false);
  assert.ok(service.getCatalog().unavailable[0].errors[0].includes('escapes'));
}));
test('settings saves synchronize manager selection and reject unavailable ids', async () => fixture(async (root, packs, logs) => {
  await addPack(packs); await addPack(packs, manifest('fixture-future'));
  const service = manager(root, packs, logs); await service.initialize();
  const result = await service.saveSettings({ ...defaultSettings, activeCharacterId: 'fixture-future', opacity: 0.8 });
  assert.equal(service.getActiveCharacter()?.id, result.activeCharacterId);
  await assert.rejects(service.saveSettings({ ...defaultSettings, activeCharacterId: 'not-installed' }));
  assert.equal(service.getActiveCharacter()?.id, 'fixture-future');
}));
test('invalid state requests and mutations cannot corrupt manager data', async () => fixture(async (root, packs, logs) => {
  await addPack(packs); const service = manager(root, packs, logs); await service.initialize();
  const pack = service.getCharacter('fixture-primary')!; pack.states.normal = 'wrong.png';
  assert.equal(service.getCharacter('fixture-primary')?.states.normal, manifest().states.normal);
  await assert.rejects(service.getStateAsset('fixture-primary', 'invalid' as never));
  assert.equal(await service.getStateAsset('not-present', 'normal'), null);
}));
test('empty/missing root and corrupt stored settings do not crash initialization', async () => fixture(async (root, packs, logs) => {
  const loader = new CharacterPackLoader(join(root, 'not-present'), 'windows', validateImage);
  assert.deepEqual(await loader.discover(), { packs: [], unavailable: [] });
  await addPack(packs); await mkdir(join(root, 'settings')); await writeFile(join(root, 'settings', 'settings.json'), 'broken');
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getActiveCharacter()?.id, 'fixture-primary');
  assert.ok(logs.some(log => log.includes('Invalid or empty settings JSON')));
}));
test('bounded file reader rejects oversized and empty files', async () => fixture(async (root) => {
  const path = join(root, 'bounded'); await writeFile(path, 'too large');
  await assert.rejects(readBoundedFile(path, 2)); await writeFile(path, '');
  await assert.rejects(readBoundedFile(path, 2));
}));

test('asset directory symlinks cannot escape the pack or alias two state mappings', async () => fixture(async (root, packs, logs) => {
  const escaping = manifest('escaping-asset'); escaping.states.help = 'linked/help.png';
  const directory = await addPack(packs, escaping);
  await rm(join(directory, 'linked'), { recursive: true });
  const outside = join(root, 'outside'); await mkdir(outside); await writeFile(join(outside, 'help.png'), png);
  await symlink(outside, join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const aliased = manifest('aliased'); aliased.states.normal = 'images/normal.png'; aliased.states.help = 'alias/normal.png';
  const second = await addPack(packs, aliased); await rm(join(second, 'alias'), { recursive: true });
  await symlink(join(second, 'images'), join(second, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  const service = manager(root, packs, logs); await service.initialize();
  assert.equal(service.getCharacters().length, 0);
  assert.ok(logs.some(log => log.includes('escapes')));
  assert.ok(logs.some(log => log.includes('duplicates another resolved asset')));
}));
