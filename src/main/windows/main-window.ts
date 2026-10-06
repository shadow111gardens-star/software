import { BrowserWindow, session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export function createMainWindow(development: boolean, showOnReady = true): BrowserWindow {
  const entry = development ? 'http://127.0.0.1:5173/' : pathToFileURL(join(__dirname, '../renderer/index.html')).href;
  const window = new BrowserWindow({ width: 1100, height: 740, minWidth: 600, minHeight: 480, frame: false, show: false, backgroundColor: '#171923', webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== entry) event.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = url.protocol === 'file:' || (development && ['http:', 'ws:'].includes(url.protocol) && url.hostname === '127.0.0.1' && url.port === '5173');
    callback({ cancel: !allowed });
  });
  window.once('ready-to-show', () => { if (showOnReady) window.show(); });
  void window.loadURL(entry).catch(error => { console.error('Window failed to load', error); window.destroy(); });
  return window;
}
