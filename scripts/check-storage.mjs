import { build } from 'esbuild';
import { mkdtemp, rm, writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'anime-cursor-check-'));
try {
  const output = join(dir, 'storage.cjs');
  await build({ entryPoints: ['src/services/storage/settings-store.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs' });
  const { LocalSettingsStore } = createRequire(import.meta.url)(output);
  const store = new LocalSettingsStore(join(dir, 'data'));
  const defaults = await store.read();
  assert.equal(defaults.companionEnabled, false);
  const settings = { ...defaults, opacity: 0.7 };
  await store.write(settings);
  assert.deepEqual(await new LocalSettingsStore(join(dir, 'data')).read(), settings);
  assert.throws(() => store.write({ ...settings, opacity: 2 }));
  await Promise.all([store.write({ ...settings, opacity: 0.3 }), store.write({ ...settings, opacity: 0.9 })]);
  assert.equal((await store.read()).opacity, 0.9);
  const data = join(dir, 'data');
  const full = { ...defaults, onboardingCompleted: true, activeCharacterId: 'aiko', companionEnabled: true, companionPaused: false, companionVisible: false, characterSize: 132, cursorOffset: { x: 38, y: -12 }, opacity: .65, smoothing: .2, startMinimized: true };
  await store.write(full);
  assert.deepEqual(await new LocalSettingsStore(data).read(), full);
  const disk = JSON.parse(await readFile(join(data, 'settings.json'), 'utf8'));
  assert.equal(disk.version, 1); assert.deepEqual(Object.keys(disk).sort(), ['settings', 'version']);
  assert.deepEqual(Object.keys(disk.settings).sort(), Object.keys(defaults).sort());
  // Legacy and partial documents keep valid fields, repair individual invalid values,
  // and discard cursor/runtime objects rather than serializing them.
  for (const version of [undefined, 0, 1]) {
    const partial = { ...full, opacity: 7, cursorOffset: { x: 42, y: 'bad' }, characterSize: 140, smoothing: null, companionPaused: true, activeCharacterId: '../escape', cursorPosition: { x: 99 }, currentState: 'extra' };
    await writeFile(join(data, 'settings.json'), JSON.stringify(version === undefined ? partial : { version, settings: partial }));
    const recovered = await new LocalSettingsStore(data, () => {}).read();
    assert.equal(recovered.characterSize, 140); assert.equal(recovered.opacity, defaults.opacity);
    assert.deepEqual(recovered.cursorOffset, { x: 42, y: defaults.cursorOffset.y });
    assert.equal(recovered.activeCharacterId, null); assert.equal(recovered.companionPaused, false);
    assert.equal(recovered.onboardingCompleted, true); assert.equal(recovered.companionVisible, false);
    assert.equal(recovered.smoothing, defaults.smoothing);
    const repaired = JSON.parse(await readFile(join(data, 'settings.json'), 'utf8'));
    assert.equal(repaired.version, 1); assert.ok(!('currentState' in repaired.settings));
  }
  await writeFile(join(data, 'settings.json'), '{broken');
  assert.equal((await new LocalSettingsStore(data, () => {}).read()).opacity, .9, 'Previous committed backup restores malformed JSON');
  for (const contents of ['', '{invalid', '{}', 'null', '[]']) {
    const path = join(dir, 'case-' + Math.random()); await mkdir(path);
    await writeFile(join(path, 'settings.json'), contents);
    assert.deepEqual(await new LocalSettingsStore(path, () => {}).read(), defaults);
    assert.equal(JSON.parse(await readFile(join(path, 'settings.json'), 'utf8')).version, 1);
    assert.equal((await readdir(path)).filter(name => name.startsWith('settings.recovered-')).length, 1);
  }
  // Pending changes are available to the overlay before asynchronous disk completion.
  const pending = store.write({ ...full, characterSize: 155 });
  assert.equal((await store.read()).characterSize, 155); await pending;
  assert.equal((await new LocalSettingsStore(data).read()).characterSize, 155);
  assert.equal((await readdir(data)).some(name => name.endsWith('.tmp')), false);
  const failurePath = join(dir, 'write-failure');
  const failureStore = new LocalSettingsStore(failurePath, () => {});
  await failureStore.read();
  await rm(join(failurePath, 'settings.json'));
  await mkdir(join(failurePath, 'settings.json'));
  await assert.rejects(failureStore.write({ ...defaults, opacity: .4 }));
  assert.deepEqual(await failureStore.read(), defaults, 'A failed commit rolls memory back to the durable state');
  assert.equal((await readdir(failurePath)).some(name => name.endsWith('.tmp')), false);
  console.log('PASS: defaults, durable restart, all preferences, schema/legacy migration, field recovery, invalid/empty JSON, backup recovery, runtime exclusion, immediate memory updates and serialized atomic writes');
} finally { await rm(dir, { recursive: true, force: true }); }
