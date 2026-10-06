import { windowsPlatform } from '../../platform/windows';
import { macosPlatform } from '../../platform/macos';
import type { PlatformFoundation } from '../../platform/types';
export function getPlatform(): PlatformFoundation {
  if (process.platform === 'win32') return windowsPlatform;
  if (process.platform === 'darwin') return macosPlatform;
  return { name: 'unsupported', capabilities: { cursorTracking: false, overlay: false, tray: false, startup: false } };
}
