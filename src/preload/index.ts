import { contextBridge, ipcRenderer } from 'electron'
import type { KaiokeApi } from './api'

const api: KaiokeApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
  session: {
    getState: () => ipcRenderer.invoke('session:get-state'),
    start: () => ipcRenderer.invoke('session:start'),
    stop: () => ipcRenderer.invoke('session:stop'),
    getSnapshot: () => ipcRenderer.invoke('session:get-snapshot'),
    removeQueueItem: queueItemId => ipcRenderer.invoke('session:remove-queue-item', queueItemId),
    reorderQueueItem: (queueItemId, targetIndex) => ipcRenderer.invoke('session:reorder-queue-item', queueItemId, targetIndex),
    playbackCommand: command => ipcRenderer.invoke('session:playback-command', command),
    toggleFullscreen: () => ipcRenderer.invoke('session:toggle-fullscreen'),
    onStateChanged: listener => {
      const callback = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state)
      ipcRenderer.on('session:state-changed', callback)
      return () => ipcRenderer.removeListener('session:state-changed', callback)
    },
  },
}

contextBridge.exposeInMainWorld('kaioke', api)
