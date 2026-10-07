import { Tray, Menu, nativeImage, type MenuItemConstructorOptions } from 'electron';
import type { TrayAdapter } from '../types';
import type { AppPage, CompanionAction } from '../../shared/types/local-flow';
import type { LocalAppFlow } from '../../services/app/local-app-flow';
export interface TrayActions { show(page?: AppPage): void; hide(): void; quit(): void }
export class ElectronTrayAdapter implements TrayAdapter {
  private tray: Tray | null = null; private remove: (() => void) | null = null;
  private menu: Menu | null = null;
  constructor(private readonly flow: LocalAppFlow, private readonly actions: TrayActions) {}
  create(): void {
    if (this.tray) return;
    // A tiny code-native tray glyph, independent of installed artwork; no new character asset.
    const pixels = Buffer.alloc(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const ring = Math.hypot(x - 15.5, y - 15.5); const eye = y >= 12 && y <= 15 && ((x >= 9 && x <= 12) || (x >= 19 && x <= 22));
      const smile = y >= 21 && y <= 23 && x >= 11 && x <= 20;
      if ((ring >= 12 && ring <= 15) || eye || smile) { const i = (y * 32 + x) * 4; pixels[i] = 215; pixels[i + 1] = 210; pixels[i + 2] = 45; pixels[i + 3] = 255; }
    }
    const icon = nativeImage.createFromBitmap(pixels, { width: 32, height: 32 }).resize({ width: process.platform === 'darwin' ? 18 : 20, height: process.platform === 'darwin' ? 18 : 20 });
    if (process.platform === 'darwin') icon.setTemplateImage(true);
    this.tray = new Tray(icon); this.tray.setToolTip('Anime Cursor');
    this.tray.on('click', () => { if (process.platform !== 'darwin') this.actions.show(); });
    this.tray.on('double-click', () => this.actions.show()); this.tray.on('right-click', () => this.refresh());
    this.remove = this.flow.subscribe(() => this.refresh()); this.refresh();
  }
  private run(work: () => Promise<unknown>): void { void work().catch(error => { console.error('[tray]', error); this.actions.show(); }); }
  refresh(): void {
    if (!this.tray) return;
    const snapshot = this.flow.getSnapshot();
    const action = (value: CompanionAction) => () => this.run(() => this.flow.action(value));
    const items: MenuItemConstructorOptions[] = [
      { id: 'show-app', label: 'Show App', click: () => this.actions.show() },
      { id: 'hide-app', label: 'Hide App', click: () => this.actions.hide() }, { type: 'separator' },
      { id: 'show-companion', label: 'Show Companion', enabled: snapshot.settings.companionEnabled, click: action('show') },
      { id: 'hide-companion', label: 'Hide Companion', enabled: snapshot.settings.companionEnabled, click: action('hide') },
      { id: 'pause-companion', label: 'Pause Companion', click: action('pause') },
      { id: 'resume-companion', label: 'Resume Companion', enabled: !!snapshot.catalog.activeCharacterId, click: action('resume') },
      { id: 'change-character', label: 'Change Character', submenu: [
        { id: 'open-store', label: 'Open Store', click: () => this.actions.show('store') },
        ...snapshot.catalog.characters.map(pack => ({ id: `character-${pack.id}`, label: pack.name, type: 'radio' as const, checked: pack.id === snapshot.catalog.activeCharacterId, click: () => this.run(() => this.flow.activate(pack.id)) })),
      ] },
      { id: 'settings', label: 'Settings', click: () => this.actions.show('settings') }, { type: 'separator' },
      { id: 'quit', label: 'Quit', click: () => this.actions.quit() },
    ];
    this.menu = Menu.buildFromTemplate(items); this.tray.setContextMenu(this.menu);
  }
  // Read-only access for explicit local integration checks; never exposed through preload.
  getMenu(): Menu | null { return this.menu; }
  isCreated(): boolean { return !!this.tray && !this.tray.isDestroyed(); }
  dispose(): void { this.remove?.(); this.remove = null; this.tray?.destroy(); this.tray = null; this.menu = null; }
}

