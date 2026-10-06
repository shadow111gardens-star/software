import { screen } from 'electron';
import { PollingCursorAdapter } from '../cursor/polling-cursor-adapter';
import { readDesktopCursor } from '../cursor/electron-screen-source';
export class MacOSCursorAdapter extends PollingCursorAdapter {
  constructor(intervalMs = 16) {
    // Chromium reads NSEvent.mouseLocation and flips AppKit's y axis to top-left DIPs.
    // This reads location only; it installs no event tap or global input monitor.
    super(() => readDesktopCursor(screen, 'macos-system'), intervalMs);
  }
}
