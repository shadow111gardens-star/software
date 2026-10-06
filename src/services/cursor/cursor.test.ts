import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PollingCursorAdapter, type CursorScheduler } from '../../platform/cursor/polling-cursor-adapter';
import { readDesktopCursor } from '../../platform/cursor/electron-screen-source';
import { CursorTrackingService } from './cursor-tracking-service';
import type { CursorPosition } from '../../shared/types/cursor';
class Timers implements CursorScheduler {
  callback: (() => void) | null = null;
  starts = 0; stops = 0; failStop = false;
  start(callback: () => void): unknown { this.callback = callback; this.starts++; return this.starts; }
  stop(): void { if (this.failStop) throw new Error('timer stop failed'); this.callback = null; this.stops++; }
  tick(): void { this.callback?.(); }
}
const position = (): CursorPosition => ({ x: -1200, y: -300, timestamp: 123, displayId: 'left', scaleFactor: 1.5, source: 'windows-system' });
function fixture() {
  const timers = new Timers(); let point = position(); let fail = false;
  const adapter = new PollingCursorAdapter(() => { if (fail) throw new Error('native failure / permission denied'); return { ...point }; }, 16, timers);
  const logs: string[] = []; const service = new CursorTrackingService(adapter, message => logs.push(message));
  return { timers, adapter, service, logs, move: (next: Partial<CursorPosition>) => { point = { ...point, ...next }; }, fail: (value: boolean) => { fail = value; } };
}
test('adapter starts once, reads real source callback immediately, stops and restarts', () => {
  const f = fixture(); f.adapter.start(); f.adapter.start(); assert.equal(f.timers.starts, 1);
  assert.deepEqual(f.adapter.getCurrentPosition(), position()); f.adapter.stop(); f.adapter.stop();
  assert.equal(f.timers.stops, 1); assert.equal(f.timers.callback, null); f.adapter.start(); assert.equal(f.timers.starts, 2); f.adapter.stop();
});
test('service duplicate start protection and stop cleans subscriptions', () => {
  const f = fixture(); let count = 0; f.service.subscribe(() => count++);
  assert.equal(f.service.start().status, 'active'); f.service.start(); assert.equal(f.timers.starts, 1);
  assert.equal(count, 1); f.service.stop(); f.move({ x: -50 }); f.timers.tick(); assert.equal(count, 1);
  f.service.start(); assert.equal(count, 2); f.service.dispose(); assert.equal(f.timers.callback, null);
});
test('subscribe/unsubscribe deduplicates listeners and stationary samples avoid events', () => {
  const f = fixture(); let count = 0; const listener = () => count++;
  const remove = f.service.subscribe(listener); f.service.subscribe(listener); f.service.start();
  f.move({ timestamp: 124 }); f.timers.tick(); assert.equal(count, 1); assert.equal(f.service.getCurrentPosition()?.timestamp, 124);
  f.move({ y: -301 }); f.timers.tick(); assert.equal(count, 2); remove();
  f.move({ y: -302 }); f.timers.tick(); assert.equal(count, 2); f.service.unsubscribe(listener); f.service.dispose();
});
test('negative coordinates and mixed-DPI display changes are preserved without scaling', () => {
  const f = fixture(); f.service.start(); assert.equal(f.service.getCurrentPosition()?.x, -1200);
  f.move({ x: 400, y: 100, displayId: 'retina', scaleFactor: 2 }); f.timers.tick();
  assert.equal(f.service.getCurrentPosition()?.x, 400); assert.equal(f.service.getCurrentPosition()?.scaleFactor, 2); f.service.dispose();
});
test('Electron screen source resolves per-display scale without converting DIPs twice', () => {
  for (const source of ['windows-system', 'macos-system'] as const) {
    const result = readDesktopCursor({ getCursorScreenPoint: () => ({ x: -1920, y: -200 }), getDisplayNearestPoint: point => { assert.deepEqual(point, { x: -1920, y: -200 }); return { id: 42, scaleFactor: 2 }; } }, source);
    assert.equal(result.x, -1920); assert.equal(result.y, -200); assert.equal(result.displayId, '42'); assert.equal(result.scaleFactor, 2); assert.equal(result.source, source); assert.ok(result.timestamp > 0);
  }
});
test('initialization/start failure is contained and recoverable', () => {
  const f = fixture(); f.fail(true); assert.equal(f.service.start().status, 'error');
  assert.equal(f.timers.callback, null); assert.ok(f.logs[0].includes('permission denied'));
  f.fail(false); assert.equal(f.service.start().status, 'active'); f.service.dispose();
});
test('runtime native failure stops the loop and reports status without throwing', () => {
  const f = fixture(); f.service.start(); f.fail(true); assert.doesNotThrow(() => f.timers.tick());
  assert.equal(f.service.getSnapshot().status, 'error'); assert.equal(f.timers.callback, null);
  f.fail(false); f.service.start(); assert.equal(f.service.getSnapshot().status, 'active'); f.service.dispose();
});
test('invalid native values fail safely but negative values are valid', () => {
  const f = fixture(); f.move({ x: NaN }); assert.equal(f.service.start().status, 'error');
  f.move({ x: -12, scaleFactor: 0 }); assert.equal(f.service.start().status, 'error');
  f.move({ scaleFactor: 1 }); assert.equal(f.service.start().status, 'active'); f.service.dispose();
});
test('stop failure reports error, detaches observers, and permits cleanup retry', () => {
  const f = fixture(); let events = 0; f.service.subscribe(() => events++); f.service.start();
  f.timers.failStop = true; assert.equal(f.service.stop().status, 'error');
  f.move({ x: 20 }); f.timers.tick(); assert.equal(events, 1);
  f.timers.failStop = false; assert.equal(f.service.stop().status, 'stopped'); assert.equal(f.timers.callback, null); f.service.dispose();
});
test('unsupported platforms and disposal never start fake tracking', () => {
  const unsupported = new CursorTrackingService(null); assert.equal(unsupported.start().status, 'unsupported'); assert.equal(unsupported.getCurrentPosition(), null); unsupported.dispose();
  const f = fixture(); f.service.start(); f.service.dispose(); assert.equal(f.service.start().status, 'stopped'); assert.equal(f.timers.starts, 1);
  f.service.subscribe(() => assert.fail('disposed subscriber called')); f.timers.tick();
});
test('sample copies protect source and other subscribers from mutation', () => {
  const f = fixture(); f.service.subscribe(update => { update.position.x = 999; });
  f.service.subscribe(update => assert.equal(update.position.x, -1200)); f.service.start();
  const current = f.service.getCurrentPosition()!; current.x = 100; assert.equal(f.service.getCurrentPosition()?.x, -1200); f.service.dispose();
});
test('stopping from an initial sample subscriber does not leave a timer running', () => {
  const f = fixture(); f.service.subscribe(() => f.service.stop());
  assert.equal(f.service.start().status, 'stopped'); assert.equal(f.timers.callback, null);
});
test('interval is bounded and configurable; display scale-only changes notify', () => {
  assert.throws(() => new PollingCursorAdapter(position, 0)); assert.throws(() => new PollingCursorAdapter(position, 1.5));
  const f = fixture(); let updates = 0; f.service.subscribe(() => updates++); f.service.start();
  f.move({ scaleFactor: 1.25 }); f.timers.tick(); assert.equal(updates, 2); assert.equal(f.service.getSnapshot().intervalMs, 16); f.service.dispose();
});
