import type { SemanticCursorAdapter, SemanticCursorSample } from '../../shared/types/state';
// No supported global semantic cursor API is available through the current macOS integration.
// Never substitute NSCursor.currentCursor from our process for another app's cursor.
export class MacOSSemanticCursorAdapter implements SemanticCursorAdapter {
  start(): void {} stop(): void {}
  getSample(): SemanticCursorSample { return { state: null, reliable: false, source: 'macos-unavailable', timestamp: Date.now(), error: null }; }
}
