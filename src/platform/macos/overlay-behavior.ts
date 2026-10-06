import type { BrowserWindow } from 'electron';
export function configureMacOSOverlay(window: BrowserWindow): void {
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setHiddenInMissionControl(true);
}
