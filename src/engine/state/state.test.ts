import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_STATES, isCursorState, type CursorState } from '../../shared/constants/cursor-states';
import type { CursorContext } from '../../shared/types/state';
import { StateManager } from './state-manager';
import { StateDetector } from './state-detector';
import { resourceState } from '../../platform/windows/cursor-resource-map';
import { CharacterStateResolver } from '../../services/characters/character-state-resolver';
import type { CharacterPack } from '../../shared/types/character';
import type { CharacterAsset } from '../../shared/types/character';
import { CompanionController } from '../../services/companion/companion-controller';
import { CursorStateEngine } from '../../services/state/cursor-state-engine';
import { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
import { PollingCursorAdapter } from '../../platform/cursor/polling-cursor-adapter';
import type { OverlayContent } from '../../shared/types/overlay';
import { defaultSettings } from '../../shared/constants/settings';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function companionFixture() {
  const cursor = new CursorTrackingService(new PollingCursorAdapter(() => ({ x: 100, y: 100, displayId: '1', scaleFactor: 1, timestamp: Date.now(), source: 'windows-system' }), 16, { start: () => 1, stop: () => undefined }));
  cursor.start(); let starts = 0; let stops = 0;
  const engine = new CursorStateEngine(cursor, { start: () => { starts++; }, stop: () => { stops++; }, getSample: () => ({ state: 'text', reliable: true, source: 'test-os', timestamp: Date.now(), error: null }) });
  let frame: (() => void) | null = null; let created = 0; let destroyed = 0; let content: OverlayContent | null = null; let active = 'future';
  let delayState: CursorState | null = null; let release: (() => void) | null = null;
  const asset = (id: string, state: CursorState): CharacterAsset => ({ characterId: id, requestedState: state, resolvedState: state, fallback: false, dataUrl: state });
  const controller = new CompanionController({ cursor, stateEngine: engine, characters: {
    getActiveCharacter: () => ({ id: active, version: '1.0.0' } as CharacterPack),
    getStateAsset: (id, state) => state === delayState ? new Promise(resolve => { release = () => resolve(asset(id, state)); }) : Promise.resolve(asset(id, state)),
  }, settings: async () => structuredClone(defaultSettings), dimensions: () => ({ width: 100, height: 80 }), display: () => ({ x: 0, y: 0, width: 1920, height: 1080, id: '1' }), createOverlay: () => {
    created++; return { load: async next => { content = next; }, update: async next => { content = next; }, setBounds: () => undefined, show: () => undefined, hide: () => undefined, dispose: () => { destroyed++; }, onFailure: () => undefined };
  }, frames: { start: callback => { frame = callback; return 1; }, stop: () => { frame = null; }, now: () => 16 }, log: () => undefined });
  return { controller, engine, cursor, counts: () => ({ created, destroyed, starts, stops }), content: () => content, tick: () => frame?.(), changeCharacter: () => { active = 'new-character'; }, delay: (state: CursorState) => { delayState = state; }, release: () => release?.() };
}
function context(state: unknown = 'normal', reliable = true): CursorContext {
  return { position: null, previousPosition: null, movement: { dx: 900, dy: -900, distance: 1272, speed: 90000 }, trackingStatus: 'active', semantic: { state: state as CursorState, reliable, source: 'test-os', timestamp: 100, error: null }, timestamp: 100 };
}
test('authoritative exact 16 states; invalid values cannot become a state', () => {
  const manager = new StateManager(); assert.equal(CURSOR_STATES.length, 16);
  for (const state of CURSOR_STATES) { manager.update(context(state)); assert.equal(manager.getCurrentState(), state); }
  for (const invalid of ['seventeenth', 'unknown', undefined, null, 3]) { assert.equal(isCursorState(invalid), false); manager.update(context(invalid)); assert.equal(manager.getCurrentState(), 'normal'); }
});
test('movement cannot determine semantics; unknown/stale/unreliable/inactive use normal', () => {
  const detector = new StateDetector();
  assert.equal(detector.detect(context(null)).state, 'normal');
  assert.equal(detector.detect(context('busy', false)).state, 'normal');
  assert.equal(detector.detect({ ...context('text'), timestamp: 5000 }).state, 'normal');
  assert.equal(detector.detect({ ...context('text'), trackingStatus: 'stopped' }).state, 'normal');
  const failed = context('text'); failed.semantic.error = 'native failure'; assert.equal(detector.detect(failed).state, 'normal');
});
test('state changes notify once; duplicate subscription, unsubscribe and reset are deterministic', () => {
  const manager = new StateManager(); const events: string[] = []; const listener = (state: CursorState) => events.push(state);
  manager.subscribe(listener); manager.subscribe(listener);
  manager.update(context()); manager.update(context('text')); manager.update(context('text')); manager.update(context('link')); manager.reset(); manager.reset();
  assert.deepEqual(events, ['text', 'link', 'normal']);
  manager.unsubscribe(listener); manager.update(context('busy')); assert.equal(events.length, 3);
});
test('override has priority, AUTO restores current semantic context, inactive resets displayed state', () => {
  const manager = new StateManager(); manager.update(context('text')); manager.setOverride('extra'); manager.update(context('link'));
  assert.equal(manager.getCurrentState(), 'extra'); assert.equal(manager.getSnapshot().source, 'development-override');
  manager.setOverride(null); assert.equal(manager.getCurrentState(), 'link');
  manager.setOverride('diagonalSecondary'); manager.update({ ...context('text'), trackingStatus: 'stopped' }); assert.equal(manager.getCurrentState(), 'normal');
  manager.reset(); assert.equal(manager.getSnapshot().override, null); manager.setOverride('invalid'); assert.equal(manager.getCurrentState(), 'normal');
});
test('Windows resource mappings are semantic; diagonal identities stay distinct', () => {
  assert.equal(resourceState(32513), 'text'); assert.equal(resourceState(32649), 'link'); assert.equal(resourceState(32650), 'working');
  assert.equal(resourceState(32642), 'diagonal'); assert.equal(resourceState(32643), 'diagonalSecondary'); assert.equal(resourceState(123456), null);
});
test('resolver delegates every state, caches successful assets and keys active character identity', async () => {
  let id = 'future'; const calls: string[] = [];
  const resolver = new CharacterStateResolver({ getActiveCharacter: () => ({ id, version: '1.0.0' } as CharacterPack), getStateAsset: async (characterId, state) => { calls.push(`${characterId}/${state}`); return { characterId, requestedState: state, resolvedState: state, dataUrl: state, fallback: false }; } });
  for (const state of CURSOR_STATES) { assert.equal((await resolver.resolve(state))?.dataUrl, state); await resolver.resolve(state); }
  assert.equal(calls.length, 16); id = 'new'; await resolver.resolve('text'); assert.equal(calls.at(-1), 'new/text');
  resolver.clear(); await resolver.resolve('text'); assert.equal(calls.length, 18);
});
test('resolver retains CharacterManager fallback and retries failed/fallback assets', async () => {
  let calls = 0;
  const resolver = new CharacterStateResolver({ getActiveCharacter: () => ({ id: 'future', version: '1' } as CharacterPack), getStateAsset: async (characterId, state) => { calls++; return calls <= 2 ? { characterId, requestedState: state, resolvedState: 'normal', dataUrl: 'normal', fallback: true } : null; } });
  assert.equal((await resolver.resolve('busy'))?.resolvedState, 'normal'); await resolver.resolve('busy'); await resolver.resolve('busy'); await resolver.resolve('busy'); assert.equal(calls, 4);
});
test('all 16 assets update one overlay and retain position; AUTO and character refresh keep current semantics', async () => {
  const f = companionFixture(); await Promise.all([f.controller.start(), f.controller.start()]);
  assert.equal(f.controller.getSnapshot().state, 'text');
  const bounds = f.controller.getSnapshot().bounds;
  for (const state of CURSOR_STATES) { f.engine.manager.setOverride(state); await flush(); assert.equal(f.content()?.state, state); assert.deepEqual(f.controller.getSnapshot().bounds, bounds); }
  assert.equal(f.counts().created, 1); f.engine.manager.setOverride(null); await flush(); assert.equal(f.content()?.state, 'text');
  f.changeCharacter(); await f.controller.refresh(); assert.equal(f.content()?.characterId, 'new-character'); assert.equal(f.content()?.state, 'text'); assert.equal(f.counts().created, 1);
  f.controller.dispose(); f.cursor.dispose();
});
test('stop/reset/restart clean state listeners and native sampler; tracking stop/resume resets normal', async () => {
  const f = companionFixture(); await f.controller.start(); f.engine.start(); assert.equal(f.counts().starts, 1);
  f.cursor.stop(); f.tick(); await flush(); assert.equal(f.engine.manager.getCurrentState(), 'normal'); assert.equal(f.counts().stops, 1);
  f.cursor.start(); f.tick(); await flush(); assert.equal(f.engine.manager.getCurrentState(), 'text'); assert.equal(f.counts().starts, 2);
  f.controller.stop(); assert.equal(f.engine.manager.getCurrentState(), 'normal'); assert.equal(f.engine.manager.getSnapshot().override, null);
  f.engine.manager.setOverride('extra'); await flush(); assert.equal(f.counts().destroyed, 1);
  await f.controller.start(); f.engine.manager.setOverride('link'); await flush(); assert.equal(f.content()?.state, 'link'); assert.equal(f.counts().created, 2);
  f.controller.dispose(); assert.equal(f.counts().starts, f.counts().stops); f.cursor.dispose();
});
test('out-of-order asset reads cannot overwrite the latest state or resurrect stopped overlay', async () => {
  const f = companionFixture(); await f.controller.start(); f.delay('busy'); f.engine.manager.setOverride('busy');
  f.engine.manager.setOverride('link'); await flush(); f.release(); await flush(); assert.equal(f.content()?.state, 'link');
  f.delay('working'); f.engine.manager.setOverride('working'); f.controller.stop(); f.release(); await flush();
  assert.equal(f.controller.getSnapshot().status, 'stopped'); assert.equal(f.counts().created, 1); f.cursor.dispose();
});
test('hidden companion still resets state and pauses semantic sampling when tracking stops', async () => {
  const f = companionFixture(); await f.controller.start(); f.controller.hide();
  f.cursor.stop(); await flush(); assert.equal(f.engine.manager.getCurrentState(), 'normal'); assert.equal(f.counts().stops, 1);
  f.controller.stop(); const starts = f.counts().starts; f.cursor.start(); assert.equal(f.counts().starts, starts);
  f.controller.dispose(); f.cursor.dispose();
});
