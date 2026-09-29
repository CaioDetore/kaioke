import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { SessionServer } from './session-server'
import { QueueRepository } from './queue-repository'

const isDevelopment = !app.isPackaged
let sessionServer: SessionServer

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
  const repository = await QueueRepository.open(path.join(app.getPath('userData'), 'kaioke.sqlite'))
  sessionServer = new SessionServer({ repository })
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('session:get-state', () => sessionServer.getState())
  ipcMain.handle('session:start', () => sessionServer.start())
  ipcMain.handle('session:stop', () => sessionServer.stop())
  sessionServer.onState(state => BrowserWindow.getAllWindows().forEach(window => window.webContents.send('session:state-changed', state)))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { void sessionServer?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
