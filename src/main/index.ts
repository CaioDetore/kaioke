import { app, BrowserWindow, ipcMain, Menu, powerSaveBlocker } from 'electron'
import path from 'node:path'
import { SessionServer } from './session-server'
import { QueueRepository } from './queue-repository'

const isDevelopment = !app.isPackaged
let sessionServer: SessionServer
let sleepBlockerId: number | undefined

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0b12',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  })

  if (isDevelopment) void window.loadURL('http://localhost:5173')
  else void window.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  const repository = await QueueRepository.open(path.join(app.getPath('userData'), 'kaioke.sqlite'))
  sessionServer = new SessionServer({ repository })
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('session:get-state', () => sessionServer.getState())
  ipcMain.handle('session:start', () => sessionServer.start())
  ipcMain.handle('session:stop', () => sessionServer.stop())
  ipcMain.handle('session:get-snapshot', () => sessionServer.getSnapshot())
  ipcMain.handle('session:remove-queue-item', (_event, queueItemId: string) => sessionServer.removeQueueItemAsHost(queueItemId))
  ipcMain.handle('session:reorder-queue-item', (_event, queueItemId: string, targetIndex: number) => sessionServer.reorderQueueAsHost(queueItemId, targetIndex))
  ipcMain.handle('session:playback-command', (_event, command) => sessionServer.playbackCommandAsHost(command))
  ipcMain.handle('session:toggle-fullscreen', event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    window.setFullScreen(!window.isFullScreen())
    return window.isFullScreen()
  })
  sessionServer.onState(state => {
    if (state.phase === 'accepting' && sleepBlockerId === undefined) sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    if (state.phase !== 'accepting' && sleepBlockerId !== undefined) { powerSaveBlocker.stop(sleepBlockerId); sleepBlockerId = undefined }
    BrowserWindow.getAllWindows().forEach(window => window.webContents.send('session:state-changed', state))
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { if (sleepBlockerId !== undefined) powerSaveBlocker.stop(sleepBlockerId); void sessionServer?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
