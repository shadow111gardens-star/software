import { contextBridge, ipcRenderer } from 'electron';
import { channels, stateChannels, flowChannels } from '../shared/constants/ipc';
import type { DesktopAPI } from '../shared/types/app';
const api: DesktopAPI = { flow: { getSnapshot: () => ipcRenderer.invoke(flowChannels.snapshot), getProducts: () => ipcRenderer.invoke(flowChannels.products), navigate: page => ipcRenderer.invoke(flowChannels.navigate, page), activate: id => ipcRenderer.invoke(flowChannels.activate, id), completeOnboarding: () => ipcRenderer.invoke(flowChannels.onboarding), companion: action => ipcRenderer.invoke(flowChannels.companion, action), preferences: patch => ipcRenderer.invoke(flowChannels.preferences, patch), buy: id => ipcRenderer.invoke(flowChannels.buy, id) }, state: { getSnapshot: () => ipcRenderer.invoke(stateChannels.snapshot), setOverride: state => ipcRenderer.invoke(stateChannels.override, state) }, companion: { start: () => ipcRenderer.invoke(channels.companionStart), stop: () => ipcRenderer.invoke(channels.companionStop), show: () => ipcRenderer.invoke(channels.companionShow), hide: () => ipcRenderer.invoke(channels.companionHide), getSnapshot: () => ipcRenderer.invoke(channels.companionSnapshot), quit: () => ipcRenderer.invoke(channels.quit) }, cursor: { getSnapshot: () => ipcRenderer.invoke(channels.cursorSnapshot), start: () => ipcRenderer.invoke(channels.cursorStart), stop: () => ipcRenderer.invoke(channels.cursorStop) }, characters: {
  getCharacters: () => ipcRenderer.invoke(channels.characters),
  getCharacter: id => ipcRenderer.invoke(channels.character, id),
  getActiveCharacter: () => ipcRenderer.invoke(channels.activeCharacter),
  hasCharacter: id => ipcRenderer.invoke(channels.hasCharacter, id),
  setActiveCharacter: id => ipcRenderer.invoke(channels.activateCharacter, id),
  getStateAsset: (id, state) => ipcRenderer.invoke(channels.stateAsset, id, state),
}, getInfo: () => ipcRenderer.invoke(channels.info), getSettings: () => ipcRenderer.invoke(channels.read), saveSettings: settings => ipcRenderer.invoke(channels.write, settings), minimize: () => ipcRenderer.invoke(channels.minimize), toggleMaximize: () => ipcRenderer.invoke(channels.maximize), close: () => ipcRenderer.invoke(channels.close) };
contextBridge.exposeInMainWorld('animeCursor', api);
