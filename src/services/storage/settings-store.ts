import { mkdir, readFile, rename, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppSettings } from '../../shared/types/app';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
import { migrateAppState, persistedState } from './app-state';
export interface SettingsStore { read(): Promise<AppSettings>; write(settings: AppSettings): Promise<AppSettings> }
export class LocalSettingsStore implements SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  private cache: AppSettings | null = null;
  private durable: AppSettings | null = null;
  private loading: Promise<AppSettings> | null = null;
  private revision = 0;
  constructor(private readonly directory: string, private readonly log: (message: string) => void = console.warn) {}
  read(): Promise<AppSettings> {
    if (this.cache) return Promise.resolve(structuredClone(this.cache));
    if (!this.loading) {
      const task = this.queue.then(() => this.load());
      this.loading = task; this.queue = task.catch(() => undefined);
    }
    return this.loading.then(() => structuredClone(this.cache!));
  }
  private async load(): Promise<AppSettings> {
    const target = join(this.directory, 'settings.json');
    let original: string | null = null;
    let input: unknown;
    let backup = false;
    let preserved = false;
    try {
      original = await readFile(target, 'utf8');
      try { input = JSON.parse(original); }
      catch {
        this.log('[storage] Invalid or empty settings JSON; recovering local preferences.');
        await this.preserve(original); preserved = true;
        try { input = JSON.parse(await readFile(target + '.bak', 'utf8')); backup = true; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; input = {}; }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      input = {};
      this.log('[storage] No settings file; initializing local defaults.');
    }
    const migrated = migrateAppState(input);
    if (migrated.repaired || backup || original === null) {
      if (original !== null && !preserved) {
        // Preserve recoverable legacy/partial/future documents before normalizing them.
        await this.preserve(original);
      }
      this.log('[storage] Settings migrated/repaired to schema version 1.');
      await this.atomic(target, JSON.stringify(migrated.state, null, 2));
    }
    this.durable = migrated.state.settings;
    if (this.revision === 0) this.cache = migrated.state.settings;
    return structuredClone(this.cache ?? migrated.state.settings);
  }
  private async preserve(contents: string): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, 'settings.recovered-' + Date.now() + '-' + randomUUID() + '.json');
    const file = await open(path, 'wx', 0o600);
    try { await file.writeFile(contents, 'utf8'); await file.sync(); } finally { await file.close(); }
  }
  private async atomic(target: string, contents: string): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temporary = target + '.' + randomUUID() + '.tmp';
    try {
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(contents, 'utf8'); await file.sync(); } finally { await file.close(); }
      await rename(temporary, target);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') this.log('[storage] Temporary file cleanup failed: ' + error.message); }); }
  }
  write(settings: AppSettings): Promise<AppSettings> {
    const validated = validateSettings(settings);
    const revision = ++this.revision;
    this.cache = structuredClone(validated);
    const task = this.queue.then(async () => {
      const target = join(this.directory, 'settings.json');
      if (!this.durable) await this.load();
      // Backup only a successfully committed version, never an unvalidated partial file.
      if (this.durable) await this.atomic(target + '.bak', JSON.stringify(persistedState(this.durable), null, 2));
      await this.atomic(target, JSON.stringify(persistedState(validated), null, 2));
      this.durable = validated;
      return structuredClone(validated);
    }).catch(error => {
      if (this.revision === revision) this.cache = structuredClone(this.durable ?? defaultSettings);
      this.log('[storage] Local settings save failed: ' + String(error)); throw error;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}

