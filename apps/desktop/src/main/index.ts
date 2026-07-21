/**
 * Electron Main entry point.
 *
 * Architecture §8.1: Electron Main manages OS capabilities, window creation,
 * and Runtime lifecycle. It does NOT implement Workflow, Run, or Gate logic.
 * Architecture §14: contextIsolation=true, nodeIntegration=false, sandbox=true.
 */

import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { RuntimeSupervisor } from './runtime-supervisor'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

let mainWindow: BrowserWindow | null = null
let supervisor: RuntimeSupervisor | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // Architecture §14: security model
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  })

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', '..', 'renderer', '.vite', 'renderer', MAIN_WINDOW_VITE_NAME, 'index.html')
    )
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  // Start the Runtime supervisor (handles Python subprocess lifecycle)
  supervisor = new RuntimeSupervisor()
  supervisor.on('status', (healthy) => {
    mainWindow?.webContents.send('runtime:status', { healthy })
  })
  supervisor.on('error', (err) => {
    mainWindow?.webContents.send('runtime:error', { message: err.message })
  })
  supervisor.spawn()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  supervisor?.shutdown()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
