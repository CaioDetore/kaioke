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
    onStateChanged: listener => {
      const callback = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state)
      ipcRenderer.on('session:state-changed', callback)
      return () => ipcRenderer.removeListener('session:state-changed', callback)
    },
  },
}

contextBridge.exposeInMainWorld('kaioke', api)
