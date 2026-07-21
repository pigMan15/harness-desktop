/**
 * Electron Main entry point.
 *
 * Architecture §8.1: Electron Main manages OS capabilities, window creation,
 * and Runtime lifecycle. It does NOT implement Workflow, Run, or Gate logic.
 * Architecture §14: contextIsolation=true, nodeIntegration=false, sandbox=true.
 */

import { app, BrowserWindow, ipcMain } from 'electron'
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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    // Production: renderer is at ../renderer/main_window/index.html relative to build output
    const rendererPath = path.join(__dirname, '..', 'renderer', MAIN_WINDOW_VITE_NAME, 'index.html')
    console.log('[Main] Loading renderer from:', rendererPath)
    mainWindow.loadFile(rendererPath)
  }

  // Open DevTools in development (comment out for release)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  // IPC handler: health check (Renderer → Main → Runtime)
  ipcMain.handle('runtime:health', async () => {
    if (!supervisor || !supervisor.port) return { status: 'starting' }
    try {
      const url = `http://127.0.0.1:${supervisor.port}/health`
      console.log('[Main] Health check:', url)
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${supervisor.token}`,
          'X-Harness-Desktop-Version': '0.0.0',
        },
      })
      if (resp.ok) {
        const data = await resp.json()
        console.log('[Main] Health OK:', JSON.stringify(data))
        return data
      }
      console.log('[Main] Health failed:', resp.status)
      return { status: 'unavailable', error: `HTTP ${resp.status}` }
    } catch (err: any) {
      console.log('[Main] Health error:', err.message)
      return { status: 'unavailable', error: err.message }
    }
  })

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
