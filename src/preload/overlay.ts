import { contextBridge, ipcRenderer } from 'electron';
import { channels, stateChannels } from '../shared/constants/ipc';
import type { OverlayRendererAPI } from '../shared/types/overlay';
const api: OverlayRendererAPI = { getContent: () => ipcRenderer.invoke(channels.overlayContent), ready: () => ipcRenderer.invoke(channels.overlayReady), failed: message => ipcRenderer.invoke(channels.overlayFailed, message), applied: revision => ipcRenderer.invoke(stateChannels.overlayApplied, revision), onContent: listener => {
  const receive = (_event: Electron.IpcRendererEvent, content: Parameters<typeof listener>[0], revision: number) => listener(content, revision);
  ipcRenderer.on(stateChannels.overlayUpdate, receive); return () => ipcRenderer.removeListener(stateChannels.overlayUpdate, receive);
} };
contextBridge.exposeInMainWorld('animeOverlay', api);
