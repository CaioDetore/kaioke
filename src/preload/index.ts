import { contextBridge, ipcRenderer } from 'electron'
import type { KaiokeApi } from './api'

const api: KaiokeApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
}

contextBridge.exposeInMainWorld('kaioke', api)
