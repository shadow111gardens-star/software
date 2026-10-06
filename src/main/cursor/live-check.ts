import { app, screen, type BrowserWindow } from 'electron';
import type { CursorTrackingService } from '../../services/cursor/cursor-tracking-service';
export function runLiveCursorCheck(window: BrowserWindow, service: CursorTrackingService): void {
  const started = Date.now();
  const cpu = process.cpuUsage();
  let updates = 0;
  let unfocusedUpdates = 0;
  const points = new Set<string>();
  const displays = new Set<string>();
  const remove = service.subscribe(({ position }) => {
    updates++;
    if (!window.isFocused()) unfocusedUpdates++;
    points.add(`${position.x},${position.y}`);
    displays.add(position.displayId);
  });
  console.info('[cursor-check] Move across applications now. Recording for 45 seconds.');
  console.info(`[cursor-check] displays=${JSON.stringify(screen.getAllDisplays().map(display => ({ id: String(display.id), bounds: display.bounds, scaleFactor: display.scaleFactor })))}`);
  const timer = setInterval(() => console.info(`[cursor-check] ${JSON.stringify({ focused: window.isFocused(), ...service.getSnapshot() })}`), 2000);
  const finish = setTimeout(() => {
    clearInterval(timer); remove();
    const beforeStop = service.getSnapshot();
    service.stop();
    const stopped = service.getSnapshot();
    const frozenTimestamp = stopped.position?.timestamp;
    setTimeout(() => {
      const cleanupPassed = stopped.status === 'stopped' && service.getCurrentPosition()?.timestamp === frozenTimestamp;
      const usage = process.cpuUsage(cpu);
      const result = { active: beforeStop.status === 'active', updates, distinctPoints: points.size, unfocusedUpdates, visitedDisplays: [...displays], cleanupPassed, elapsedMs: Date.now() - started, cpuMilliseconds: (usage.user + usage.system) / 1000, lastPosition: beforeStop.position };
      console.info(`[cursor-check] RESULT ${JSON.stringify(result)}`);
      service.dispose(); app.exit(result.active && cleanupPassed ? 0 : 1);
    }, 100);
  }, 45000);
  app.once('will-quit', () => { clearInterval(timer); clearTimeout(finish); remove(); });
}
