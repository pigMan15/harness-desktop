/**
 * Electron Main entry point.
 *
 * Architecture §8.1: Electron Main manages OS capabilities, window creation,
 * and Runtime lifecycle. It does NOT implement Workflow, Run, or Gate logic.
 * Architecture §14: contextIsolation=true, nodeIntegration=false, sandbox=true.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execSync } from 'node:child_process'
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

  // ── Runtime API helper ──
  async function runtimeCall(method: string, params?: any): Promise<any> {
    if (!supervisor || !supervisor.port) return { error: 'Runtime not started' }
    try {
      const resp = await fetch(`http://127.0.0.1:${supervisor.port}/api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisor.token}`,
          'X-Harness-Desktop-Version': '0.0.0',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: `req-${Date.now()}` }),
      })
      if (resp.ok) {
        const envelope = await resp.json()
        // Unwrap JSON-RPC envelope: return result or error
        if (envelope.result !== undefined) return envelope.result
        if (envelope.error) return { error: envelope.error.message || envelope.error }
        return envelope
      }
      return { error: `HTTP ${resp.status}` }
    } catch (err: any) {
      return { error: err.message }
    }
  }

  // ── IPC: Health ──
  ipcMain.handle('runtime:health', async () => {
    if (!supervisor || !supervisor.port) return { status: 'starting' }
    try {
      const resp = await fetch(`http://127.0.0.1:${supervisor.port}/health`, {
        headers: { Authorization: `Bearer ${supervisor.token}`, 'X-Harness-Desktop-Version': '0.0.0' },
      })
      if (resp.ok) return await resp.json()
      return { status: 'unavailable', error: `HTTP ${resp.status}` }
    } catch (err: any) {
      return { status: 'unavailable', error: err.message }
    }
  })

  // ── IPC: Projects ──
  ipcMain.handle('project:list', async () => runtimeCall('project.list'))
  ipcMain.handle('project:import', async (_e, path: string) => {
    const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return { error: 'No window available' }
    // If path is provided and not a special trigger, import directly
    if (path && path !== '__dialog__' && path !== '.') {
      return runtimeCall('project.import', { path })
    }
    const result = await dialog.showOpenDialog(win, {
      title: 'Import .harness Project',
      properties: ['openDirectory'],
    })
    if (result.canceled) return { error: 'cancelled' }
    return runtimeCall('project.import', { path: result.filePaths[0] })
  })
  ipcMain.handle('project:validate', async (_e, path: string) => runtimeCall('project.validate', { path }))

  // ── IPC: Runs ──
  ipcMain.handle('run:list', async (_e, projectId: string) => runtimeCall('run.list', { projectId }))
  ipcMain.handle('run:create', async (_e, projectId: string, intent: string, risk: string, runId: string) =>
    runtimeCall('run.create', { projectId, intent, risk, runId }))

  // ── IPC: Workflow ──
  ipcMain.handle('workflow:get', async (_e, projectId: string) => runtimeCall('workflow.get', { projectId }))
  ipcMain.handle('workflow:compile', async (_e, projectId: string, intent: string, risk: string) =>
    runtimeCall('workflow.compile', { projectId, intent, risk }))
  ipcMain.handle('workflow:diff', async (_e, projectId: string, yaml: string) =>
    runtimeCall('workflow.diff', { projectId, yaml }))
  ipcMain.handle('workflow:apply', async (_e, projectId: string, yaml: string, hash: string) =>
    runtimeCall('workflow.apply', { projectId, yaml, hash }))

  // ── IPC: Gates ──
  ipcMain.handle('gate:list', async (_e, projectId: string) => runtimeCall('gate.list', { projectId }))
  ipcMain.handle('gate:evaluate', async (_e, gateId: string, status: string) =>
    runtimeCall('gate.evaluate', { gateId, status }))

  // ── IPC: Artifacts ──
  ipcMain.handle('artifact:list', async (_e, projectId: string) => runtimeCall('artifact.list', { projectId }))
  ipcMain.handle('artifact:read', async (_e, projectId: string, filename: string) =>
    runtimeCall('artifact.read', { projectId, filename }))

  // ── IPC: Knowledge ──
  ipcMain.handle('knowledge:list', async (_e, projectId: string, status: string) =>
    runtimeCall('knowledge.list', { projectId, status }))
  ipcMain.handle('knowledge:review', async (_e, candidateId: number, decision: string) =>
    runtimeCall('knowledge.review', { candidateId, decision }))

  // ── IPC: Execution ──
  ipcMain.handle('execution:start', async (_e, projectId: string, nodeId: string, role: string) =>
    runtimeCall('execution.start', { projectId, nodeId, role }))
  ipcMain.handle('execution:poll', async (_e, sessionId: string) =>
    runtimeCall('execution.poll', { sessionId }))
  ipcMain.handle('execution:respond', async (_e, sessionId: string, decision: any) =>
    runtimeCall('execution.respond', { sessionId, decision }))
  ipcMain.handle('execution:cancel', async (_e, sessionId: string) =>
    runtimeCall('execution.cancel', { sessionId }))

  // ── IPC: Recovery ──
  ipcMain.handle('recovery:scan', async (_e, projectId: string) => runtimeCall('recovery.scan', { projectId }))
  ipcMain.handle('recovery:cleanup', async (_e, projectId: string) => runtimeCall('recovery.cleanup', { projectId }))

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
