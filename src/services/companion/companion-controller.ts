import type { AppSettings } from '../../shared/types/app';
import type { CharacterAsset, CharacterPack } from '../../shared/types/character';
import type { CursorPosition } from '../../shared/types/cursor';
import type { CompanionSnapshot, OverlayBounds, OverlayContent } from '../../shared/types/overlay';
import type { OverlayAdapter } from '../../platform/types';
import type { CursorTrackingService } from '../cursor/cursor-tracking-service';
import { characterDimensions, clampBounds, cursorOverlayBounds, OVERLAY_PADDING, smoothPoint, type DesktopArea } from '../../engine/character/overlay-geometry';
import type { CursorState } from '../../shared/constants/cursor-states';
import type { CursorStateEngine } from '../state/cursor-state-engine';
import { CharacterStateResolver } from '../characters/character-state-resolver';
export interface CompanionDependencies {
  characters: { getActiveCharacter(): CharacterPack | null; getStateAsset(id: string, state: CursorState): Promise<CharacterAsset | null> };
  stateEngine?: CursorStateEngine;
  cursor: CursorTrackingService;
  settings(): Promise<AppSettings>;
  dimensions(dataUrl: string): { width: number; height: number };
  display(cursor: CursorPosition): DesktopArea;
  createOverlay(): OverlayAdapter;
  frames: { start(callback: () => void): unknown; stop(handle: unknown): void; now(): number };
  log?(message: string): void;
}
export class CompanionController {
  private snapshot: CompanionSnapshot = { status: 'stopped', characterId: null, state: 'normal', bounds: null, visible: false, error: null };
  private overlay: OverlayAdapter | null = null;
  private generation = 0;
  private pending: Promise<CompanionSnapshot> | null = null;
  private timer: unknown = null;
  private unsubscribe: (() => void) | null = null;
  private settings: AppSettings | null = null;
  private image: { width: number; height: number } | null = null;
  private target: CursorPosition | null = null;
  private displayed: { x: number; y: number } | null = null;
  private displayId: string | null = null;
  private lastFrame = 0;
  private ownsTracking = false;
  private disposed = false;
  private removeState: (() => void) | null = null;
  private assetVersion = 0;
  private resolver: CharacterStateResolver;
  constructor(private readonly dependencies: CompanionDependencies) { this.resolver = new CharacterStateResolver(dependencies.characters); }
  getSnapshot(): CompanionSnapshot { return structuredClone(this.snapshot); }
  isActive(): boolean { return ['starting', 'running', 'hidden'].includes(this.snapshot.status); }
  start(): Promise<CompanionSnapshot> {
    if (this.disposed) return Promise.resolve(this.getSnapshot());
    if (this.pending) return this.pending;
    if (this.snapshot.status === 'running' || this.snapshot.status === 'hidden') return Promise.resolve(this.getSnapshot());
    const generation = ++this.generation;
    this.snapshot = { ...this.snapshot, status: 'starting', error: null };
    const task = this.initialize(generation);
    this.pending = task;
    void task.finally(() => { if (this.pending === task) this.pending = null; });
    return task;
  }
  private async initialize(generation: number): Promise<CompanionSnapshot> {
    const current = () => generation === this.generation && !this.disposed;
    try {
      const character = this.dependencies.characters.getActiveCharacter();
      if (!character) throw new Error('No valid active character');
      const settings = await this.dependencies.settings();
      if (!current()) return this.getSnapshot();
      if (this.dependencies.cursor.getSnapshot().status !== 'active') {
        this.ownsTracking = true;
        if (this.dependencies.cursor.start().status !== 'active') throw new Error('Cursor tracking unavailable');
      }
      const cursor = this.dependencies.cursor.getCurrentPosition();
      if (!cursor) throw new Error('No cursor sample');
      this.dependencies.stateEngine?.start();
      const state = this.dependencies.stateEngine?.manager.getCurrentState() ?? 'normal';
      const asset = await this.resolver.resolve(state);
      if (!current()) return this.getSnapshot();
      if (!asset) throw new Error(`Character asset unavailable: ${character.id}/${state}`);
      const image = this.dependencies.dimensions(asset.dataUrl);
      const area = this.dependencies.display(cursor);
      const size = characterDimensions(image, settings.characterSize, area);
      this.settings = settings; this.image = image; this.target = cursor;
      const overlay = this.dependencies.createOverlay(); this.overlay = overlay;
      overlay.onFailure(message => { if (this.overlay === overlay) this.fail(message); });
      const content: OverlayContent = { characterId: character.id, state: asset.resolvedState, dataUrl: asset.dataUrl, ...size, padding: OVERLAY_PADDING, opacity: settings.opacity };
      await overlay.load(content);
      if (!current()) return this.getSnapshot();
      this.snapshot.characterId = character.id;
      this.snapshot.state = asset.resolvedState;
      this.snapshot.status = 'running';
      this.removeState = this.dependencies.stateEngine?.manager.subscribe(next => { void this.switchAsset(next); }) ?? null;
      this.displayed = null; this.displayId = null;
      // Compute initial bounds without showing a companion saved as hidden.
      this.update(true, settings.companionVisible);
      if (!settings.companionVisible && this.snapshot.status === 'running') {
        this.snapshot.visible = false; this.snapshot.status = 'hidden';
      }
      if (this.snapshot.status === 'hidden') {
        const latest = this.dependencies.stateEngine?.manager.getCurrentState() ?? state;
        if (latest !== state) void this.switchAsset(latest);
        return this.getSnapshot();
      }
      if (this.snapshot.status !== 'running') return this.getSnapshot();
      this.unsubscribe = this.dependencies.cursor.subscribe(({ position }) => { this.target = position; });
      this.lastFrame = this.dependencies.frames.now();
      this.timer = this.dependencies.frames.start(() => this.update());
      // A manual override can change while the first image is being decoded.
      const latest = this.dependencies.stateEngine?.manager.getCurrentState() ?? state;
      if (latest !== state) void this.switchAsset(latest);
    } catch (error) { if (current()) this.fail(String(error)); }
    return this.getSnapshot();
  }
  private update(snap = false, allowShow = true): void {
    if (!this.overlay || !this.settings || !this.image || this.snapshot.status !== 'running') return;
    try {
      this.dependencies.stateEngine?.tick();
      if (this.dependencies.cursor.getSnapshot().status !== 'active') { this.overlay.hide(); this.snapshot.visible = false; return; }
      // The authoritative service cache also covers stop/resume without a movement event.
      const cursor = this.dependencies.cursor.getCurrentPosition() ?? this.target;
      if (!cursor) return;
      const area = this.dependencies.display(cursor);
      const size = characterDimensions(this.image, this.settings.characterSize, area);
      const target = cursorOverlayBounds(cursor, this.settings.cursorOffset, size, area);
      const now = this.dependencies.frames.now();
      this.displayed = !this.displayed || snap || this.displayId !== area.id ? { x: target.x, y: target.y } : smoothPoint(this.displayed, target, now - this.lastFrame, this.settings.smoothing);
      this.lastFrame = now; this.displayId = area.id;
      const bounds = clampBounds({ ...target, ...this.displayed }, area);
      if (!this.snapshot.bounds || Object.keys(bounds).some(key => bounds[key as keyof OverlayBounds] !== this.snapshot.bounds![key as keyof OverlayBounds])) this.overlay.setBounds(bounds);
      this.snapshot.bounds = bounds;
      if (allowShow && !this.snapshot.visible) { this.overlay.show(); this.snapshot.visible = true; }
    } catch (error) { this.fail(String(error)); }
  }
  private async switchAsset(state: CursorState): Promise<void> {
    const version = ++this.assetVersion; const overlay = this.overlay;
    const current = () => version === this.assetVersion && overlay === this.overlay && this.isActive();
    try {
      const asset = await this.resolver.resolve(state);
      if (!current() || !overlay || !this.settings || !this.snapshot.bounds) return;
      if (!asset) throw new Error(`Character asset unavailable for ${state}; normal fallback also unavailable`);
      const image = this.dependencies.dimensions(asset.dataUrl);
      const cursor = this.dependencies.cursor.getCurrentPosition(); if (!cursor) return;
      const area = this.dependencies.display(cursor);
      const size = characterDimensions(image, this.settings.characterSize, area);
      await overlay.update({ characterId: asset.characterId, state: asset.resolvedState, dataUrl: asset.dataUrl, ...size, padding: OVERLAY_PADDING, opacity: this.settings.opacity });
      if (!current()) return;
      this.image = image; this.snapshot.state = asset.resolvedState; this.snapshot.characterId = asset.characterId;
      // Keep the displayed top-left, adjusting only size/edge fit. Movement continues independently.
      const bounds = clampBounds({ ...this.snapshot.bounds!, width: size.width + 2 * OVERLAY_PADDING, height: size.height + 2 * OVERLAY_PADDING }, area);
      overlay.setBounds(bounds); this.snapshot.bounds = bounds;
    } catch (error) { if (current()) this.fail(String(error)); }
  }
  stop(): CompanionSnapshot {
    ++this.generation; this.pending = null;
    this.cleanup();
    this.snapshot = { status: 'stopped', characterId: null, state: 'normal', bounds: null, visible: false, error: null };
    return this.getSnapshot();
  }
  hide(): CompanionSnapshot {
    if (this.snapshot.status === 'starting') return this.stop();
    if (this.snapshot.status === 'running') { this.stopMovement(); this.overlay?.hide(); this.snapshot.status = 'hidden'; this.snapshot.visible = false; }
    return this.getSnapshot();
  }
  show(): CompanionSnapshot {
    if (this.snapshot.status === 'hidden' && this.overlay) {
      this.snapshot.status = 'running'; this.target = this.dependencies.cursor.getCurrentPosition(); this.update(true);
      if (this.snapshot.status === 'running') {
        this.unsubscribe = this.dependencies.cursor.subscribe(({ position }) => { this.target = position; });
        this.lastFrame = this.dependencies.frames.now(); this.timer = this.dependencies.frames.start(() => this.update());
      }
    }
    return this.getSnapshot();
  }
  async refresh(): Promise<CompanionSnapshot> {
    if (!this.isActive()) return this.getSnapshot();
    if (this.snapshot.status === 'starting') { this.stop(); this.resolver.clear(); return this.start(); }
    const generation = this.generation;
    const settings = await this.dependencies.settings();
    if (generation !== this.generation || !this.isActive()) return this.getSnapshot();
    this.settings = settings; this.resolver.clear();
    await this.switchAsset(this.dependencies.stateEngine?.manager.getCurrentState() ?? 'normal');
    return this.getSnapshot();
  }
  dispose(): void { this.disposed = true; this.stop(); }
  private stopMovement(): void {
    if (this.timer !== null) this.dependencies.frames.stop(this.timer);
    this.timer = null; this.unsubscribe?.(); this.unsubscribe = null;
  }
  private cleanup(): void {
    ++this.assetVersion; this.removeState?.(); this.removeState = null;
    this.dependencies.stateEngine?.stop();
    this.stopMovement();
    const overlay = this.overlay; this.overlay = null;
    overlay?.dispose();
    if (this.ownsTracking) this.dependencies.cursor.stop();
    this.ownsTracking = false; this.displayed = null; this.target = null;
  }
  private fail(message: string): void {
    ++this.generation; this.cleanup();
    this.snapshot = { ...this.snapshot, status: 'error', visible: false, bounds: null, error: message };
    (this.dependencies.log ?? console.error)(`[companion] ${message}`);
  }
}
