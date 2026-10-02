import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: '解忧森林',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f6f4ee',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  // 本地语音转写要录音。不放行媒体权限的话，getUserMedia 会直接 reject，
  // 界面上只能看到一个笼统的失败，查不出是权限问题。
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  const win = createWindow()
  registerIpc(() => BrowserWindow.getAllWindows()[0] ?? win)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
