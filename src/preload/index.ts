import { contextBridge, ipcRenderer } from 'electron'
import type { KaiokeApi } from './api'

const api: KaiokeApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    openExternal: url => ipcRenderer.invoke('app:open-external', url),
    showFloatingController: () => ipcRenderer.invoke('app:show-floating-controller'),
    hideFloatingController: () => ipcRenderer.invoke('app:hide-floating-controller'),
    focusMainWindow: keepFloatingController => ipcRenderer.invoke('app:focus-main-window', keepFloatingController),
  },
  session: {
    getState: () => ipcRenderer.invoke('session:get-state'),
    start: () => ipcRenderer.invoke('session:start'),
    stop: () => ipcRenderer.invoke('session:stop'),
    getSnapshot: () => ipcRenderer.invoke('session:get-snapshot'),
    removeQueueItem: queueItemId => ipcRenderer.invoke('session:remove-queue-item', queueItemId),
    reorderQueueItem: (queueItemId, targetIndex) => ipcRenderer.invoke('session:reorder-queue-item', queueItemId, targetIndex),
    playbackCommand: command => ipcRenderer.invoke('session:playback-command', command),
    updateQueueItemMetadata: (queueItemId, title, channelName) => ipcRenderer.invoke('session:update-queue-item-metadata', queueItemId, title, channelName),
    toggleFullscreen: () => ipcRenderer.invoke('session:toggle-fullscreen'),
    onStateChanged: listener => {
      const callback = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state)
      ipcRenderer.on('session:state-changed', callback)
      return () => ipcRenderer.removeListener('session:state-changed', callback)
    },
  },
}

contextBridge.exposeInMainWorld('kaioke', api)
