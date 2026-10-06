import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
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
  console.log('PASS: defaults, persistence, invalid input rejection, serialized writes');
} finally { await rm(dir, { recursive: true, force: true }); }
