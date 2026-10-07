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

test('Store catalog includes installed Aiko and locked premium concepts', async () => {
  const f = await fixture(undefined, false, ['aiko']);
  const products = f.flow.getProducts();
  const aiko = products.find(p => p.id === 'aiko')!;
  assert.equal(aiko.installed, true); assert.equal(aiko.isFree, true); assert.equal(aiko.featured, true);
  assert.equal(aiko.characterId, 'aiko'); assert.equal(aiko.stateCount, 16); assert.ok(aiko.preview);
  for (const name of ['Neko', 'Yuki']) {
    const p = products.find(p => p.name === name)!;
    assert.equal(p.installed, false); assert.equal(p.isFree, false); assert.equal(p.characterId, null);
    assert.equal(p.preview, null); assert.equal(p.concept, true); assert.equal(p.stateCount, 16);
  }
});
test('all five Store filters return exactly their local catalog subsets', async () => {
  const products = (await fixture(undefined, false, ['aiko'])).flow.getProducts();
  for (const filter of ['all', 'featured', 'free', 'premium', 'installed'] as const) {
    const expected = products.filter(p => filter === 'all' || (filter === 'featured' && p.featured) || (filter === 'free' && p.isFree) || (filter === 'premium' && !p.isFree) || (filter === 'installed' && p.installed));
    assert.deepEqual(filterProducts(products, filter), expected);
  }
});
test('Store search is trimmed, case-insensitive, local and composes with filters', async () => {
  const products = (await fixture(undefined, false, ['aiko'])).flow.getProducts();
  assert.deepEqual(filterProducts(products, 'all', '  AIKO  ').map(p => p.id), ['aiko']);
  assert.deepEqual(filterProducts(products, 'premium', 'nEkO').map(p => p.name), ['Neko']);
  assert.equal(filterProducts(products, 'free', 'Neko').length, 0);
  assert.deepEqual(filterProducts(products, 'featured', '   '), filterProducts(products, 'featured'));
  assert.equal(filterProducts(products, 'all', 'not-in-catalog').length, 0);
});
test('every mock Buy leaves preferences, selection and catalog unchanged', async () => {
  const f = await fixture(undefined, false, ['aiko']);
  const before = f.flow.getSnapshot(); const products = f.flow.getProducts();
  const writes = (f.storage as MemorySettings).writes;
  for (const product of products.filter(p => !p.isFree && !p.installed)) {
    assert.equal(f.flow.buy(product.id), 'Purchases coming soon');
    assert.deepEqual(f.flow.getSnapshot(), before); assert.deepEqual(f.flow.getProducts(), products);
  }
  assert.equal((f.storage as MemorySettings).writes, writes);
  assert.throws(() => f.flow.buy('aiko')); assert.throws(() => f.flow.buy('missing'));
});
test('empty installed catalog and isolated product copies cannot create ownership', async () => {
  const f = await fixture(undefined, true);
  assert.equal(filterProducts(f.flow.getProducts(), 'installed').length, 0);
  const copy = f.flow.getProducts(); copy[0].installed = true;
  assert.equal(f.flow.getProducts()[0].installed, false);
  await assert.rejects(f.flow.activate('concept-neko'), /unavailable/i);
});
class MemorySettings implements SettingsStore {
  value = structuredClone(defaultSettings); writes = 0;
  async read() { return structuredClone(this.value); }
  async write(value: AppSettings) { this.writes++; this.value = validateSettings(value); return this.read(); }
}
async function fixture(storage: SettingsStore = new MemorySettings(), empty = false, ids = ['local-one', 'local-two']) {
  const packs: CharacterPack[] = empty ? [] : ids.map(id => ({ id, name: id, version: '1.0.0', description: 'Installed pack', platforms: ['windows'], states: Object.fromEntries(CURSOR_STATES.map(state => [state, `${state}.png`])) as CharacterPack['states'], metadata: {} }));
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
  assert.equal(filterProducts(products, 'premium').length, 4); assert.equal(filterProducts(products, 'free').length, 2); assert.equal(filterProducts(products, 'all', 'sAkUrA').length, 1); assert.equal(filterProducts(products, 'all', 'no-match').length, 0);
  const before = await f.storage.read(); assert.match(f.flow.buy('concept-sakura'), /Purchases coming soon/); assert.deepEqual(await f.storage.read(), before); assert.equal(f.catalog.getProducts().find(product => product.id === 'concept-sakura')?.installed, false);
  assert.equal(validProduct(null), false); assert.equal(validProduct({ name: null }), false); assert.equal(validProduct({ ...products[0], stateCount: 17 }), false); assert.throws(() => f.flow.buy('missing'));
});
test('navigation validates pages; Quit drains accepted writes and rejects later actions', async () => {
  const f = await fixture(); for (const page of ['home', 'store', 'settings'] as const) assert.equal(f.flow.navigate(page).page, page);
  assert.throws(() => f.flow.navigate('accounts' as never));
  assert.throws(() => f.flow.navigate('characters' as never));
  const save = f.flow.preferences({ smoothing: .25 }); const closing = f.flow.prepareQuit(); await Promise.all([save, closing]); assert.equal((await f.storage.read()).smoothing, .25); await assert.rejects(f.flow.action('resume'), /closing/);
});
test('skip completes persistently, opens Home, and respects automatic startup preference', async () => {
  for (const auto of [true, false]) {
    const f = await fixture(); await f.flow.activate('local-one');
    await f.flow.preferences({ startCompanionAutomatically: auto }); f.flow.navigate('settings');
    const result = await f.flow.skipOnboarding();
    assert.equal(result.page, 'home'); assert.equal(result.settings.onboardingCompleted, true);
    assert.equal(result.companion.status, auto ? 'running' : 'stopped');
    const reopened = await fixture(f.storage); assert.equal(reopened.flow.getSnapshot().settings.onboardingCompleted, true);
    assert.equal(reopened.flow.getSnapshot().page, 'home');
    assert.equal(reopened.flow.getSnapshot().settings.activeCharacterId, 'local-one');
  }
});
test('Restart Setup persists only explicit reset and preserves appearance and selected character', async () => {
  const f = await fixture(); await f.flow.activate('local-two'); await f.flow.completeOnboarding();
  await f.flow.preferences({ characterSize: 120, opacity: .7 }); f.flow.navigate('settings');
  const restarted = await f.flow.restartOnboarding();
  assert.equal(restarted.settings.onboardingCompleted, false); assert.equal(restarted.page, 'home');
  assert.equal(restarted.companion.status, 'stopped'); assert.equal(restarted.settings.characterSize, 120);
  assert.equal(restarted.settings.activeCharacterId, 'local-two');
  const reopened = await fixture(f.storage); assert.equal(reopened.flow.getSnapshot().settings.onboardingCompleted, false);
  assert.equal(reopened.counts().created, 0);
  await reopened.flow.completeOnboarding(); assert.equal(reopened.flow.getSnapshot().settings.onboardingCompleted, true);
});
test('setup completion selects Aiko through CharacterManager when another pack was active', async () => {
  const f = await fixture(undefined, false, ['aiko', 'local-two']);
  await f.flow.activate('local-two'); await f.flow.completeOnboarding();
  assert.equal(f.flow.getSnapshot().settings.activeCharacterId, 'aiko');
  assert.equal(f.flow.getSnapshot().companion.characterId, 'aiko');
  await f.flow.restartOnboarding(); await f.flow.activate('local-two'); await f.flow.skipOnboarding();
  assert.equal(f.flow.getSnapshot().settings.activeCharacterId, 'local-two', 'Skip preserves an existing selection');
});

