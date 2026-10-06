import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppSettings } from '../../shared/types/app';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
export interface SettingsStore { read(): Promise<AppSettings>; write(settings: AppSettings): Promise<AppSettings> }
export class LocalSettingsStore implements SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) {}
  async read(): Promise<AppSettings> {
    await this.queue;
    try { return validateSettings(JSON.parse(await readFile(join(this.directory, 'settings.json'), 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(defaultSettings); throw error; }
  }
  write(settings: AppSettings): Promise<AppSettings> {
    const validated = validateSettings(settings);
    const task = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const target = join(this.directory, 'settings.json');
      await writeFile(target + '.tmp', JSON.stringify(validated, null, 2), 'utf8');
      await rename(target + '.tmp', target);
      return structuredClone(validated);
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
