import { app, BrowserWindow, ipcMain, Menu, powerSaveBlocker, screen, shell } from 'electron'
import path from 'node:path'
import { SessionServer } from './session-server'
import { QueueRepository } from './queue-repository'

const isDevelopment = !app.isPackaged
let sessionServer: SessionServer
let sleepBlockerId: number | undefined
let mainWindow: BrowserWindow | undefined
let mainWindowTopTimer: ReturnType<typeof setTimeout> | undefined
let floatingControllerWindow: BrowserWindow | undefined

const floatingControllerPage = `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controle Kaioke</title><style>*{box-sizing:border-box}html,body,main{width:100%;height:100%;margin:0;overflow:hidden}body{background:transparent;font-family:system-ui}main{display:flex;align-items:center;gap:8px;padding:7px 9px;border:2px solid transparent;border-radius:999px;background:linear-gradient(115deg,#171126,#111923 52%,#20112a) padding-box,linear-gradient(90deg,#ff4fd8,#865cff,#49e8ff,#80f5a9,#ff4fd8) border-box;background-size:auto,300% 100%;box-shadow:inset 0 1px #ffffff20,0 7px 24px #000b;animation:rgb 5s linear infinite;-webkit-app-region:drag}@keyframes rgb{to{background-position:0 0,300% 0}}.brand,.spacer,button{position:relative;z-index:1}.brand{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:conic-gradient(#ff61d8,#885cff,#48eaff,#86f7a4,#ff61d8);box-shadow:0 0 13px #a15fff99;animation:spin 4s linear infinite}.brand::before{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#423060,#171322 62%);content:''}.brand::after{position:absolute;width:8px;height:8px;border:2px solid #e8e2ff;border-radius:50%;background:#15111f;content:''}@keyframes spin{to{transform:rotate(360deg)}}.spacer{flex:1}button{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid #ffffff2d;border-radius:50%;background:#ffffff12;color:#fff;box-shadow:inset 0 1px #ffffff1f,0 3px 8px #0007;cursor:pointer;-webkit-app-region:no-drag}button:hover{background:#ffffff2b;box-shadow:0 0 12px #6eeaff80}button:active{transform:scale(.92)}button:focus-visible{outline:2px solid #70eaff;outline-offset:2px}button:disabled{opacity:.5}#close{color:#f2d7ff}svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style><main aria-label="Controle Kaioke"><span class="brand" title="Kaioke" aria-label="Kaioke"></span><span class="spacer"></span><button id="skip" type="button" title="Pular música" aria-label="Pular música"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 10 8L5 20V4Z"/><path d="M19 5v14"/></svg></button><button id="maximize" type="button" title="Abrir Kaioke" aria-label="Abrir Kaioke"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1"/><path d="M9 5V3h12v12h-2"/></svg></button><button id="close" type="button" title="Fechar controle" aria-label="Fechar controle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></main><script>document.querySelector('#skip').onclick=async()=>{const button=document.querySelector('#skip');button.disabled=true;try{await window.kaioke.session.playbackCommand({action:'skip'})}finally{setTimeout(()=>button.disabled=false,500)}};document.querySelector('#maximize').onclick=()=>window.kaioke.app.focusMainWindow();document.querySelector('#close').onclick=()=>window.kaioke.app.hideFloatingController()</script></html>`

function showFloatingController(): void {
  if (!floatingControllerWindow || floatingControllerWindow.isDestroyed()) {
    const workArea = screen.getPrimaryDisplay().workArea
    floatingControllerWindow = new BrowserWindow({ width: 202, height: 58, x: workArea.x + workArea.width - 218, y: workArea.y + 16, frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#00000000', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, '../preload/index.js') } })
    floatingControllerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    void floatingControllerWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(floatingControllerPage)}`)
    floatingControllerWindow.on('closed', () => { floatingControllerWindow = undefined })
  }
  floatingControllerWindow.setAlwaysOnTop(true, 'floating')
  floatingControllerWindow.showInactive()
}

function hideFloatingController(): void { floatingControllerWindow?.hide() }

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
  mainWindow = window
  window.on('closed', () => { if (mainWindow === window) mainWindow = undefined })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDevelopment) void window.loadURL('http://localhost:5173')
  else void window.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  const repository = await QueueRepository.open(path.join(app.getPath('userData'), 'kaioke.sqlite'))
  sessionServer = new SessionServer({ repository })
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:show-floating-controller', () => showFloatingController())
  ipcMain.handle('app:hide-floating-controller', () => hideFloatingController())
  ipcMain.handle('app:focus-main-window', (_event, keepFloatingController = true) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isMaximized()) mainWindow.maximize()
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.show(); mainWindow.moveTop(); mainWindow.focus()
    if (mainWindowTopTimer) clearTimeout(mainWindowTopTimer)
    mainWindowTopTimer = setTimeout(() => { mainWindow?.setAlwaysOnTop(false); mainWindowTopTimer = undefined }, 800)
    if (keepFloatingController) showFloatingController()
    return true
  })
  ipcMain.handle('app:open-external', (_event, url: string) => {
    if (!url.startsWith('https://') && !url.startsWith('http://')) return false
    if (mainWindowTopTimer) { clearTimeout(mainWindowTopTimer); mainWindowTopTimer = undefined }
    mainWindow?.setAlwaysOnTop(false)
    return shell.openExternal(url).then(() => true)
  })
  ipcMain.handle('session:get-state', () => sessionServer.getState())
  ipcMain.handle('session:start', () => sessionServer.start())
  ipcMain.handle('session:stop', () => sessionServer.stop())
  ipcMain.handle('session:get-snapshot', () => sessionServer.getSnapshot())
  ipcMain.handle('session:remove-queue-item', (_event, queueItemId: string) => sessionServer.removeQueueItemAsHost(queueItemId))
  ipcMain.handle('session:reorder-queue-item', (_event, queueItemId: string, targetIndex: number) => sessionServer.reorderQueueAsHost(queueItemId, targetIndex))
  ipcMain.handle('session:playback-command', (_event, command) => sessionServer.playbackCommandAsHost(command))
  ipcMain.handle('session:update-queue-item-metadata', (_event, queueItemId: string, title: string, channelName?: string) => sessionServer.updateQueueItemMetadataAsHost(queueItemId, title, channelName))
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
