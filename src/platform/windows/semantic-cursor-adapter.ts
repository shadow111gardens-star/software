import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';
import type { SemanticCursorAdapter, SemanticCursorSample } from '../../shared/types/state';
import { resourceState, WINDOWS_CURSOR_RESOURCES } from './cursor-resource-map';
export class WindowsSemanticCursorAdapter implements SemanticCursorAdapter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private sample: SemanticCursorSample = { state: null, reliable: false, source: 'windows-starting', timestamp: 0, error: null };
  private buffer = ''; private started = 0;
  constructor(private readonly now = () => Date.now(), private readonly log = console.error) {}
  start(): void {
    if (this.child) return;
    this.buffer = ''; this.started = this.now(); this.sample = { state: null, reliable: false, source: 'windows-starting', timestamp: this.started, error: null };
    // Local compiled read-only bridge; no shell, arbitrary commands, or input interception.
    const executable = join(__dirname, '../native/windows/cursor-context.exe');
    const child = spawn(executable, [String(process.pid), ...Object.keys(WINDOWS_CURSOR_RESOURCES)], { windowsHide: true, stdio: 'pipe' });
    this.child = child;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      if (this.child !== child) return;
      this.buffer += data;
      if (this.buffer.length > 8192) { this.fail('Invalid native helper output'); return; }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end).trim(); this.buffer = this.buffer.slice(end + 1);
        if (!line) continue;
        try {
          const record: unknown = JSON.parse(line);
          if (!record || typeof record !== 'object' || !('id' in record) || !('ok' in record) || typeof record.ok !== 'boolean') throw new Error('Invalid sample');
          const state = resourceState(record.id);
          if (!record.ok && this.sample.error !== 'GetCursorInfo failed') this.log('[state] GetCursorInfo failed; using extra');
          this.sample = { state, reliable: record.ok && state !== null, source: record.ok && state ? 'windows-standard-cursor' : 'windows-unknown-cursor', timestamp: this.now(), error: record.ok ? null : 'GetCursorInfo failed' };
        } catch { this.fail('Invalid native helper sample'); return; }
      }
    });
    child.stderr.on('data', (data: string) => { if (this.child === child) this.fail(`Native helper failed: ${data.slice(0, 256).trim()}`); });
    child.on('error', error => { if (this.child === child) this.fail(`Native helper unavailable: ${error.message}`); });
    child.on('exit', code => { if (this.child === child) this.fail(`Native helper exited (${code})`); });
    child.stdin.end();
  }
  getSample(): SemanticCursorSample {
    if (this.child && this.now() - Math.max(this.started, this.sample.timestamp) > (this.sample.source === 'windows-starting' ? 10000 : 3000)) this.fail('Native helper heartbeat timed out');
    return { ...this.sample };
  }
  stop(): void { const child = this.child; this.child = null; child?.kill(); this.buffer = ''; this.sample = { state: null, reliable: false, source: 'windows-stopped', timestamp: this.now(), error: null }; }
  private fail(error: string): void { this.stop(); this.sample.error = error; this.sample.source = 'windows-error'; this.log(`[state] ${error}; using extra`); }
}
