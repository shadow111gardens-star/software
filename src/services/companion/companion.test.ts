import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OverlayAdapter } from '../../platform/types';
import type { OverlayBounds, OverlayContent } from '../../shared/types/overlay';
import type { CharacterPack } from '../../shared/types/character';
import { CURSOR_STATES } from '../../shared/constants/cursor-states';
import { defaultSettings } from '../../shared/constants/settings';
import { PollingCursorAdapter } from '../../platform/cursor/polling-cursor-adapter';
import { CursorTrackingService } from '../cursor/cursor-tracking-service';
import { CompanionController } from './companion-controller';
import { characterDimensions, cursorOverlayBounds, smoothPoint, type DesktopArea } from '../../engine/character/overlay-geometry';
class Port implements OverlayAdapter {
  content: OverlayContent | null = null; visible = false; disposed = false; moves: OverlayBounds[] = [];
  failure: (message: string) => void = () => undefined;
  async load(content: OverlayContent): Promise<void> { this.content = content; }
  async update(content: OverlayContent): Promise<void> { this.content = content; }
  setBounds(bounds: OverlayBounds): void { this.moves.push({ ...bounds }); }
  shows = 0; show(): void { this.shows++; this.visible = true; } hide(): void { this.visible = false; }
  dispose(): void { this.disposed = true; this.visible = false; }
  onFailure(callback: (message: string) => void): void { this.failure = callback; }
}
function fixture() {
  let cursorPoint = { x: 200, y: 200, timestamp: 1, displayId: 'primary', scaleFactor: 1.25, source: 'windows-system' as const };
  let sample: (() => void) | null = null;
  const adapter = new PollingCursorAdapter(() => ({ ...cursorPoint }), 16, { start: callback => { sample = callback; return 1; }, stop: () => { sample = null; } });
  const cursor = new CursorTrackingService(adapter); cursor.start();
  let frame: (() => void) | null = null; let now = 0; let frames = 0;
  let area: DesktopArea = { x: 0, y: 0, width: 1920, height: 1080, id: 'primary' };
  let settings = structuredClone(defaultSettings);
  let character: CharacterPack | null = { id: 'other-pack', name: 'Other', version: '1.0.0', platforms: ['windows'], states: Object.fromEntries(CURSOR_STATES.map(state => [state, `${state}.png`])) as CharacterPack['states'], metadata: {} };
  let missing = false; const ports: Port[] = []; const states: string[] = [];
  const controller = new CompanionController({ characters: {
    getActiveCharacter: () => character,
    getStateAsset: async (id, state) => { states.push(state); return missing ? null : { characterId: id, requestedState: state, resolvedState: state, fallback: false, dataUrl: 'data:image/png;base64,test' }; },
  }, cursor, settings: async () => settings, dimensions: () => ({ width: 200, height: 100 }), display: () => area,
  createOverlay: () => { const port = new Port(); ports.push(port); return port; },
  frames: { start: callback => { frame = callback; frames++; return frames; }, stop: () => { frame = null; }, now: () => now }, log: () => undefined });
  return { controller, cursor, ports, states, tick: () => { now += 16; frame?.(); }, move: (x: number, y: number, nextArea = area) => { area = nextArea; cursorPoint = { ...cursorPoint, x, y, timestamp: cursorPoint.timestamp + 1, displayId: area.id }; sample?.(); }, noCharacter: () => { character = null; }, missing: () => { missing = true; }, changeCharacter: () => { character = { ...character!, id: 'future-pack' }; }, changeSettings: () => { settings = { ...settings, characterSize: 150, opacity: 0.6 }; }, hideOnStartup: () => { settings = { ...settings, companionVisible: false }; }, hasFrame: () => frame !== null };
}
test('dimensions retain aspect ratio, padding and display fit', () => {
  const area = { x: 0, y: 0, width: 80, height: 60, id: 'small' };
  assert.deepEqual(characterDimensions({ width: 200, height: 100 }, 96, area), { width: 76, height: 38 });
  assert.throws(() => characterDimensions({ width: 0, height: 10 }, 96, area));
});
test('anchor is cursor plus offset at top-left with image padding', () => {
  const cursor = { x: 100, y: 100, displayId: '1', scaleFactor: 2, timestamp: 1, source: 'windows-system' as const };
  assert.deepEqual(cursorOverlayBounds(cursor, { x: 20, y: 18 }, { width: 96, height: 48 }, { x: 0, y: 0, width: 1920, height: 1080, id: '1' }), { x: 120, y: 118, width: 100, height: 52 });
});
test('screen edge flip and clamp keep window inside left/above monitors', () => {
  for (const area of [{ x: -1920, y: 0, width: 1920, height: 1080, id: 'left' }, { x: 0, y: -1080, width: 1920, height: 1080, id: 'above' }]) {
    for (const point of [{ x: area.x, y: area.y }, { x: area.x + area.width - 1, y: area.y + area.height - 1 }]) {
      const bounds = cursorOverlayBounds({ ...point, displayId: area.id, timestamp: 0, scaleFactor: 1.75, source: 'windows-system' }, { x: 20, y: 20 }, { width: 96, height: 90 }, area);
      assert.ok(bounds.x >= area.x && bounds.y >= area.y && bounds.x + bounds.width <= area.x + area.width && bounds.y + bounds.height <= area.y + area.height);
    }
  }
});
test('all display edges preserve DIP geometry at 100, 125 and 150 percent scaling', () => {
  for (const scaleFactor of [1, 1.25, 1.5]) {
    for (const area of [{x:0,y:0,width:1536,height:816,id:'primary'}, {x:-1920,y:0,width:1920,height:1080,id:'left'}, {x:0,y:-1080,width:1920,height:1080,id:'above'}]) {
      for (const x of [area.x, area.x+area.width/2, area.x+area.width-1]) {
        for (const y of [area.y, area.y+area.height/2, area.y+area.height-1]) {
          const bounds=cursorOverlayBounds({x,y,displayId:area.id,timestamp:0,scaleFactor,source:'windows-system'}, {x:20,y:20}, {width:96,height:90}, area);
          assert.equal(bounds.width,100); assert.equal(bounds.height,94);
          assert.ok(bounds.x>=area.x&&bounds.y>=area.y&&bounds.x+bounds.width<=area.x+area.width&&bounds.y+bounds.height<=area.y+area.height);
        }
      }
    }
  }
});
test('smoothing is time-based, converges and snaps large jumps/disabled smoothing', () => {
  const origin = { x: 0, y: 0 }; const target = { x: 100, y: 50 };
  const single = smoothPoint(origin, target, 32, 0.5);
  const twice = smoothPoint(smoothPoint(origin, target, 16, 0.5), target, 16, 0.5);
  assert.ok(Math.abs(single.x - twice.x) < 1e-8); assert.ok(single.x > 0 && single.x < 100);
  assert.deepEqual(smoothPoint(origin, target, 16, 0), target);
  assert.deepEqual(smoothPoint(origin, { x: -1000, y: 0 }, 16, 1), { x: -1000, y: 0 });
});
test('start loads generic active normal asset; concurrent starts create one overlay', async () => {
  const f = fixture(); const [first, second] = await Promise.all([f.controller.start(), f.controller.start()]);
  assert.equal(first.status, 'running'); assert.equal(second.status, 'running'); assert.equal(f.ports.length, 1);
  assert.equal(f.ports[0].content?.characterId, 'other-pack'); assert.deepEqual(f.states, ['normal']);
  assert.equal(f.ports[0].content?.width, 96); assert.equal(f.ports[0].content?.height, 48); assert.equal(f.ports[0].visible, true);
  f.controller.dispose(); f.cursor.dispose();
});
test('stop destroys overlay/frames; restart never leaves two overlays', async () => {
  const f = fixture(); await f.controller.start(); f.controller.stop();
  assert.equal(f.ports[0].disposed, true); assert.equal(f.hasFrame(), false); assert.equal(f.cursor.getSnapshot().status, 'active');
  await f.controller.start(); assert.equal(f.ports.length, 2); assert.equal(f.ports.filter(port => !port.disposed).length, 1);
  f.controller.dispose(); assert.equal(f.hasFrame(), false); assert.equal((await f.controller.start()).status, 'stopped'); f.cursor.dispose();
});
test('cancel during asynchronous start cannot resurrect a stopped companion', async () => {
  const f = fixture(); const start = f.controller.start(); f.controller.stop(); await start;
  assert.equal(f.controller.getSnapshot().status, 'stopped'); assert.equal(f.ports.length, 0); assert.equal(f.hasFrame(), false); f.cursor.dispose();
});
test('hide/show keeps one window but clears movement while hidden', async () => {
  const f = fixture(); await f.controller.start(); f.controller.hide(); assert.equal(f.ports[0].visible, false); assert.equal(f.hasFrame(), false);
  f.move(900, 600); f.controller.show(); assert.equal(f.ports.length, 1); assert.equal(f.ports[0].visible, true); assert.equal(f.controller.getSnapshot().bounds?.x, 920);
  f.controller.show(); f.controller.stop(); assert.equal(f.hasFrame(), false); f.cursor.dispose();
});
test('movement stays in main; idle frames do not reposition; display change snaps', async () => {
  const f = fixture(); await f.controller.start(); const moves = f.ports[0].moves.length; f.tick(); assert.equal(f.ports[0].moves.length, moves);
  f.move(400, 200); f.tick(); const bounds = f.controller.getSnapshot().bounds!; assert.ok(bounds.x > 220 && bounds.x < 420);
  f.move(-1800, -900, { x: -1920, y: -1080, width: 1920, height: 1080, id: 'negative' }); f.tick(); assert.equal(f.controller.getSnapshot().bounds?.x, -1780);
  f.controller.dispose(); f.cursor.dispose();
});
test('missing character/normal asset and renderer failure leave no active resources', async () => {
  const noCharacter = fixture(); noCharacter.noCharacter(); assert.equal((await noCharacter.controller.start()).status, 'error'); assert.equal(noCharacter.ports.length, 0); noCharacter.cursor.dispose();
  const missing = fixture(); missing.missing(); assert.equal((await missing.controller.start()).status, 'error'); assert.equal(missing.ports.length, 0); missing.cursor.dispose();
  const failed = fixture(); await failed.controller.start(); failed.ports[0].failure('renderer crash'); assert.equal(failed.controller.getSnapshot().status, 'error'); assert.equal(failed.ports[0].disposed, true); assert.equal(failed.hasFrame(), false); failed.cursor.dispose();
});
test('character and settings refresh reuse window with new dimensions', async () => {
  const f = fixture(); await f.controller.start(); f.changeCharacter(); f.changeSettings(); await f.controller.refresh();
  assert.equal(f.ports.length, 1); assert.equal(f.ports[0].disposed, false); assert.equal(f.ports[0].content?.characterId, 'future-pack'); assert.equal(f.ports[0].content?.width, 150); assert.equal(f.ports[0].content?.opacity, 0.6);
  f.controller.hide(); await f.controller.refresh(); assert.equal(f.controller.getSnapshot().status, 'hidden'); assert.equal(f.hasFrame(), false); f.controller.dispose(); f.cursor.dispose();
});
test('cursor stopped/error hides character; resumed tracking shows it safely', async () => {
  const f = fixture(); await f.controller.start(); f.cursor.stop(); f.tick(); assert.equal(f.ports[0].visible, false);
  f.cursor.start(); f.tick(); assert.equal(f.ports[0].visible, true); f.controller.dispose(); f.cursor.dispose();
});

test('persisted hidden preference starts without a visible flash', async () => {
  const f = fixture(); f.hideOnStartup();
  assert.equal((await f.controller.start()).status, 'hidden');
  assert.equal(f.ports[0].shows, 0); assert.equal(f.hasFrame(), false);
  f.controller.show(); assert.equal(f.ports[0].shows, 1); assert.equal(f.hasFrame(), true);
  f.controller.stop(); f.cursor.dispose();
});
