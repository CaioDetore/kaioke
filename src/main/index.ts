import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

const isDevelopment = !app.isPackaged

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

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
