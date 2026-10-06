import { screen } from 'electron';
import { PollingCursorAdapter } from '../cursor/polling-cursor-adapter';
import { readDesktopCursor } from '../cursor/electron-screen-source';
export class WindowsCursorAdapter extends PollingCursorAdapter {
  constructor(intervalMs = 16) {
    // Electron/Chromium calls GetCursorPos and converts per-display pixels to DIPs.
    super(() => readDesktopCursor(screen, 'windows-system'), intervalMs);
  }
}
