import type { CursorAdapter } from '../../platform/types';
import type { CursorListener, CursorPosition, CursorSnapshot } from '../../shared/types/cursor';
export class CursorTrackingService {
  private status: CursorSnapshot['status'];
  private error: string | null = null;
  private listeners = new Set<CursorListener>();
  private statusListeners = new Set<() => void>();
  private removePosition: (() => void) | null = null;
  private removeError: (() => void) | null = null;
  private disposed = false;
  constructor(private readonly adapter: CursorAdapter | null, private readonly log: (message: string) => void = console.error) {
    this.status = adapter ? 'stopped' : 'unsupported';
    if (!adapter) this.error = 'Cursor tracking is supported only on Windows and macOS';
  }
  start(): CursorSnapshot {
    if (this.disposed) return this.getSnapshot();
    if (!this.adapter || this.status === 'active') return this.getSnapshot();
    // Clean up even if an earlier stop failed, before attempting another start.
    try { this.adapter.stop(); } catch (error) { this.fail('stop before restart', error); return this.getSnapshot(); }
    this.detach();
    this.removePosition = this.adapter.subscribe(update => {
      for (const listener of [...this.listeners]) try { listener({ ...update, position: { ...update.position } }); } catch (error) { this.log(`[cursor] Subscriber failed: ${String(error)}`); }
    });
    this.removeError = this.adapter.onError(error => this.fail('native read', error));
    try { this.status = 'active'; this.error = null; this.adapter.start(); }
    catch (error) { this.fail('start', error); }
    this.notifyStatus();
    return this.getSnapshot();
  }
  stop(): CursorSnapshot {
    try { this.adapter?.stop(); this.status = this.adapter ? 'stopped' : 'unsupported'; if (this.adapter) this.error = null; }
    catch (error) { this.status = 'error'; this.error = `Cursor stop failed: ${String(error)}`; this.log(this.error); }
    finally { this.detach(); }
    this.notifyStatus();
    return this.getSnapshot();
  }
  getCurrentPosition(): CursorPosition | null { return this.adapter?.getCurrentPosition() ?? null; }
  getSnapshot(): CursorSnapshot { return { status: this.status, position: this.getCurrentPosition(), error: this.error, intervalMs: this.adapter?.intervalMs ?? 16 }; }
  subscribe(listener: CursorListener): () => void { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.unsubscribe(listener); }
  unsubscribe(listener: CursorListener): void { this.listeners.delete(listener); }
  subscribeStatus(listener: () => void): () => void { if (this.disposed) return () => undefined; this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  dispose(): void { this.stop(); this.listeners.clear(); this.statusListeners.clear(); this.disposed = true; }
  private notifyStatus(): void { for (const listener of [...this.statusListeners]) { try { listener(); } catch (error) { this.log(`[cursor] Status subscriber failed: ${String(error)}`); } } }
  private detach(): void { this.removePosition?.(); this.removeError?.(); this.removePosition = null; this.removeError = null; }
  private fail(operation: string, error: unknown): void {
    this.status = 'error'; this.error = `Cursor ${operation} failed: ${String(error)}`;
    try { this.adapter?.stop(); } catch (stopError) { this.error += `; cleanup failed: ${String(stopError)}`; }
    this.detach(); this.log(this.error);
    this.notifyStatus();
  }
}
