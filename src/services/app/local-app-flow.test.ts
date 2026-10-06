import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
import type { AppSettings } from '../../shared/types/app';
import type { CharacterPack } from '../../shared/types/character';
import type { CompanionSnapshot } from '../../shared/types/overlay';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import { LocalSettingsStore, type SettingsStore } from '../storage/settings-store';
import { LocalCatalogService, filterProducts, validProduct } from '../catalog/local-catalog';
import { LocalAppFlow } from './local-app-flow';
class MemorySettings implements SettingsStore {
  value = structuredClone(defaultSettings); writes = 0;
  async read() { return structuredClone(this.value); }
  async write(value: AppSettings) { this.writes++; this.value = validateSettings(value); return this.read(); }
}
async function fixture(storage: SettingsStore = new MemorySettings(), empty = false) {
  const packs: CharacterPack[] = empty ? [] : ['local-one', 'local-two'].map(id => ({ id, name: id, version: '1.0.0', description: 'Installed pack', platforms: ['windows'], states: Object.fromEntries(CURSOR_STATES.map(state => [state, `${state}.png`])) as CharacterPack['states'], metadata: {} }));
  let active: string | null = (await storage.read()).activeCharacterId ?? packs[0]?.id ?? null;
  const characters = {
    getCatalog: () => ({ characters: packs, activeCharacterId: active, unavailable: [] }), getCharacters: () => packs,
    getActiveCharacter: () => packs.find(pack => pack.id === active) ?? null,
    setActiveCharacter: async (id: string) => { const pack = packs.find(pack => pack.id === id); if (!pack) throw new Error('Character unavailable'); await storage.write({ ...await storage.read(), activeCharacterId: id }); active = id; return pack; },
    saveSettings: async (value: unknown) => { const settings = validateSettings(value); if (settings.activeCharacterId && !packs.some(pack => pack.id === settings.activeCharacterId)) throw new Error('Character unavailable'); const saved = await storage.write(settings); active = saved.activeCharacterId; return saved; },
    getStateAsset: async (id: string, state: typeof CURSOR_STATES[number]) => ({ characterId: id, requestedState: state, resolvedState: state, fallback: false, dataUrl: 'data:image/png;base64,AQ==' }),
  };
  let state: CompanionSnapshot = { status: 'stopped', characterId: null, state: 'normal', bounds: null, visible: false, error: null }; let created = 0; let refreshed = 0; let failure = false;
  const companion = {
    getSnapshot: () => structuredClone(state), isActive: () => ['running', 'hidden'].includes(state.status),
    start: async () => { if (!['running', 'hidden'].includes(state.status)) created++; state = { ...state, status: failure ? 'error' : 'running', characterId: active, visible: !failure, error: failure ? 'Test startup failed' : null }; return structuredClone(state); },
    stop: () => { state = { ...state, status: 'stopped', visible: false, state: 'normal' }; return structuredClone(state); },
    hide: () => { state = { ...state, status: 'hidden', visible: false }; return structuredClone(state); },
    show: () => { state = { ...state, status: 'running', visible: true }; return structuredClone(state); },
    refresh: async () => { if (companion.isActive()) { refreshed++; state.characterId = active; } return structuredClone(state); },
  };
  const catalog = new LocalCatalogService(characters, () => undefined); await catalog.initialize();
  const flow = new LocalAppFlow(characters, companion, storage, catalog, { platform: 'windows', version: 'test' }); await flow.initialize();
  return { flow, storage, companion, catalog, counts: () => ({ created, refreshed }), failStart: () => { failure = true; } };
}
test('legacy settings migrate new flags without discarding appearance; invalid flags rejected', () => {
  const { onboardingCompleted: _onboarding, startCompanionAutomatically: _auto, startMinimized: _minimized, ...legacy } = { ...defaultSettings, opacity: .37, characterSize: 141 };
  const migrated = validateSettings(legacy); assert.equal(migrated.onboardingCompleted, false); assert.equal(migrated.opacity, .37); assert.equal(migrated.characterSize, 141);
  assert.throws(() => validateSettings({ ...migrated, onboardingCompleted: 'yes' }));
});
test('first launch stays in onboarding; selection/start/completion persist across a real settings store restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anime-cursor-flow-unit-'));
  try {
    const f = await fixture(new LocalSettingsStore(directory)); assert.equal(f.flow.getSnapshot().settings.onboardingCompleted, false); assert.equal(f.counts().created, 0);
    await f.flow.activate('local-two'); await f.flow.completeOnboarding();
    assert.equal(f.flow.getSnapshot().status, 'Active'); assert.equal(f.flow.getSnapshot().page, 'home');
    const saved = await new LocalSettingsStore(directory).read(); assert.equal(saved.activeCharacterId, 'local-two'); assert.equal(saved.companionEnabled, true); assert.equal(saved.onboardingCompleted, true);
    const restored = await fixture(new LocalSettingsStore(directory)); assert.equal(restored.flow.getSnapshot().status, 'Active'); assert.equal(restored.counts().created, 1);
  } finally { if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe unit test directory'); await rm(directory, { recursive: true, force: true }); }
});
test('pause differs from hide; show/resume never create duplicate active overlays', async () => {
  const f = await fixture(); await f.flow.activate('local-one'); await f.flow.completeOnboarding();
  await f.flow.action('hide'); assert.equal(f.flow.getSnapshot().status, 'Hidden'); assert.equal(f.flow.getSnapshot().settings.companionEnabled, true);
  await f.flow.action('show'); assert.equal(f.flow.getSnapshot().status, 'Active'); assert.equal(f.counts().created, 1);
  await f.flow.action('pause'); assert.equal(f.flow.getSnapshot().status, 'Paused'); assert.equal((await f.storage.read()).companionEnabled, false);
  await assert.rejects(f.flow.action('show'), /Resume/); await Promise.all([f.flow.action('resume'), f.flow.action('resume')]); assert.equal(f.counts().created, 2);
});
test('automatic start respects onboarding, enabled and saved launch preference', async () => {
  for (const flags of [{ onboardingCompleted: false, companionEnabled: true, startCompanionAutomatically: true }, { onboardingCompleted: true, companionEnabled: false, startCompanionAutomatically: true }, { onboardingCompleted: true, companionEnabled: true, startCompanionAutomatically: false }]) {
    const storage = new MemorySettings(); storage.value = { ...defaultSettings, ...flags, activeCharacterId: 'local-one' }; const f = await fixture(storage); assert.equal(f.counts().created, 0);
  }
});
test('appearance patches serialize, preserve unrelated fields and reject invalid/privileged settings', async () => {
  const f = await fixture(); await f.flow.activate('local-one'); await f.flow.completeOnboarding();
  await Promise.all([f.flow.preferences({ characterSize: 144 }), f.flow.preferences({ opacity: .6 })]);
  const saved = await f.storage.read(); assert.equal(saved.characterSize, 144); assert.equal(saved.opacity, .6); assert.equal(saved.onboardingCompleted, true); assert.equal(f.counts().created, 1);
  await assert.rejects(f.flow.preferences({ opacity: 2 })); await assert.rejects(f.flow.preferences({ onboardingCompleted: false } as never)); assert.deepEqual(await f.storage.read(), saved);
});
test('character activation keeps running/hidden/paused semantics and persists active selection', async () => {
  const f = await fixture(); await f.flow.activate('local-one'); await f.flow.completeOnboarding(); await f.flow.action('hide'); await f.flow.activate('local-two');
  assert.equal(f.flow.getSnapshot().status, 'Hidden'); assert.equal(f.flow.getSnapshot().companion.characterId, 'local-two'); assert.equal((await f.storage.read()).activeCharacterId, 'local-two'); assert.equal(f.counts().created, 1);
  await f.flow.action('pause'); await f.flow.activate('local-one'); assert.equal(f.flow.getSnapshot().status, 'Paused');
});
test('empty library and startup failure preserve incomplete onboarding and show useful errors', async () => {
  const empty = await fixture(undefined, true); assert.equal(empty.flow.getSnapshot().status, 'Unavailable'); await assert.rejects(empty.flow.completeOnboarding(), /Choose an installed/);
  const failed = await fixture(); await failed.flow.activate('local-one'); failed.failStart(); await assert.rejects(failed.flow.completeOnboarding(), /Unable to start/);
  assert.equal(failed.flow.getSnapshot().settings.onboardingCompleted, false); assert.equal((await failed.storage.read()).companionEnabled, false); assert.ok(failed.flow.getSnapshot().error);
});
test('local store catalog search/filters and mock Buy never mutate user settings or ownership', async () => {
  const f = await fixture(); const products = f.catalog.getProducts(); assert.equal(products.filter(product => product.installed).length, 2);
  assert.equal(filterProducts(products, 'premium').length, 2); assert.equal(filterProducts(products, 'free').length, 2); assert.equal(filterProducts(products, 'all', 'sAkUrA').length, 1); assert.equal(filterProducts(products, 'all', 'no-match').length, 0);
  const before = await f.storage.read(); assert.match(f.flow.buy('concept-sakura'), /No payment was made/); assert.deepEqual(await f.storage.read(), before); assert.equal(f.catalog.getProducts().find(product => product.id === 'concept-sakura')?.installed, false);
  assert.equal(validProduct(null), false); assert.equal(validProduct({ name: null }), false); assert.equal(validProduct({ ...products[0], stateCount: 17 }), false); assert.throws(() => f.flow.buy('missing'));
});
test('navigation validates pages; Quit drains accepted writes and rejects later actions', async () => {
  const f = await fixture(); for (const page of ['home', 'characters', 'store', 'settings'] as const) assert.equal(f.flow.navigate(page).page, page);
  assert.throws(() => f.flow.navigate('accounts' as never));
  const save = f.flow.preferences({ smoothing: .25 }); const closing = f.flow.prepareQuit(); await Promise.all([save, closing]); assert.equal((await f.storage.read()).smoothing, .25); await assert.rejects(f.flow.action('resume'), /closing/);
});
