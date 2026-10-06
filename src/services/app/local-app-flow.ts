import type { CharacterManager } from '../characters/character-manager';
import type { CompanionController } from '../companion/companion-controller';
import type { SettingsStore } from '../storage/settings-store';
import type { AppInfo, AppSettings } from '../../shared/types/app';
import type { AppPage, CompanionAction, LocalFlowSnapshot, PreferencePatch } from '../../shared/types/local-flow';
import { APP_PAGES } from '../../shared/types/local-flow';
import { defaultSettings, validateSettings } from '../../shared/constants/settings';
import type { LocalCatalogService } from '../catalog/local-catalog';
export class LocalAppFlow {
  private settings = structuredClone(defaultSettings);
  private page: AppPage = 'home'; private error: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private closing = false;
  constructor(private readonly characters: Pick<CharacterManager, 'getCatalog' | 'getActiveCharacter' | 'setActiveCharacter' | 'saveSettings'>, private readonly companion: Pick<CompanionController, 'getSnapshot' | 'start' | 'stop' | 'show' | 'hide' | 'refresh' | 'isActive'>, private readonly storage: SettingsStore, private readonly catalog: LocalCatalogService, private readonly info: AppInfo, private readonly debugEnabled = false) {}
  async initialize(autoStart = true): Promise<void> {
    try { this.settings = await this.storage.read(); }
    catch (error) { console.error('[flow] Settings read failed', error); this.error = 'Local settings could not be read. Your existing file was preserved.'; }
    if (autoStart && !this.error && this.settings.onboardingCompleted && this.settings.companionEnabled && this.settings.startCompanionAutomatically) {
      const result = await this.companion.start();
      if (result.status === 'error') this.error = 'The companion could not start. Choose an available character and try Resume.';
    }
  }
  getSnapshot(): LocalFlowSnapshot {
    const companion = this.companion.getSnapshot(); const catalog = this.characters.getCatalog();
    const status = companion.status === 'error' ? 'Error' : !catalog.activeCharacterId ? 'Unavailable' : companion.status === 'starting' ? 'Starting' : companion.status === 'hidden' ? 'Hidden' : companion.status === 'running' ? 'Active' : 'Paused';
    return { settings: structuredClone(this.settings), companion, status, catalog, info: this.info, page: this.page, error: this.error, debugEnabled: this.debugEnabled };
  }
  getProducts() { return this.catalog.getProducts(); }
  buy(id: string): string { return this.catalog.buy(id); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) { try { listener(); } catch (error) { console.error('[flow] Subscriber failed', error); } } }
  private operation<T>(work: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('Anime Cursor is closing.'));
    const task = this.queue.then(async () => { this.error = null; try { return await work(); } catch (error) { this.error = error instanceof Error ? error.message : 'The local action could not finish.'; throw error; } finally { this.notify(); } });
    this.queue = task.catch(() => undefined); return task;
  }
  navigate(page: AppPage): LocalFlowSnapshot { if (!(APP_PAGES as readonly string[]).includes(page)) throw new Error('Unknown application page'); this.page = page; this.notify(); return this.getSnapshot(); }
  activate(id: string): Promise<LocalFlowSnapshot> { return this.operation(async () => { await this.characters.setActiveCharacter(id); this.settings = await this.storage.read(); await this.companion.refresh(); return this.getSnapshot(); }); }
  private async persist(settings: AppSettings): Promise<void> { this.settings = await this.characters.saveSettings(settings); }
  private async resume(): Promise<void> {
    if (!this.characters.getActiveCharacter()) throw new Error('Choose an installed character to start your companion.');
    await this.persist({ ...this.settings, companionEnabled: true });
    const result = await this.companion.start();
    if (!['running', 'hidden'].includes(result.status)) { await this.persist({ ...this.settings, companionEnabled: false }); throw new Error('Unable to start the companion. Check the selected character and try again.'); }
  }
  completeOnboarding(): Promise<LocalFlowSnapshot> { return this.operation(async () => { await this.resume(); await this.persist({ ...this.settings, onboardingCompleted: true }); this.page = 'home'; return this.getSnapshot(); }); }
  action(action: CompanionAction): Promise<LocalFlowSnapshot> {
    return this.operation(async () => {
      if (action === 'pause') { this.companion.stop(); await this.persist({ ...this.settings, companionEnabled: false }); }
      else if (action === 'resume') await this.resume();
      else if (action === 'hide' || action === 'show') {
        if (!this.settings.companionEnabled || !this.companion.isActive()) throw new Error('Resume the companion before changing its visibility.');
        if (action === 'hide') this.companion.hide(); else this.companion.show();
      } else throw new Error('Unknown companion action');
      return this.getSnapshot();
    });
  }
  preferences(input: PreferencePatch): Promise<LocalFlowSnapshot> {
    return this.operation(async () => {
      const keys = ['characterSize', 'cursorOffset', 'opacity', 'smoothing', 'startCompanionAutomatically', 'startMinimized'];
      if (!input || typeof input !== 'object' || Object.keys(input).some(key => !keys.includes(key))) throw new Error('Invalid preference change');
      await this.persist(validateSettings({ ...this.settings, ...input })); await this.companion.refresh(); return this.getSnapshot();
    });
  }
  replaceSettings(input: unknown): Promise<AppSettings> { return this.operation(async () => { const before = this.settings.companionEnabled; await this.persist(validateSettings(input)); if (!this.settings.companionEnabled) this.companion.stop(); else if (!before) await this.resume(); await this.companion.refresh(); return structuredClone(this.settings); }); }
  externalCharacterChanged(): Promise<unknown> { return this.operation(async () => { this.settings = await this.storage.read(); await this.companion.refresh(); return this.getSnapshot(); }); }
  dispose(): void { this.listeners.clear(); }
  async prepareQuit(): Promise<void> { this.closing = true; await this.queue; }
}
