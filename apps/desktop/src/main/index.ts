/**
 * Electron Main entry point.
 *
 * Architecture §8.1: Electron Main manages OS capabilities, window creation,
 * and Runtime lifecycle. It does NOT implement Workflow, Run, or Gate logic.
 * Architecture §14: contextIsolation=true, nodeIntegration=false, sandbox=true.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { RuntimeSupervisor } from './runtime-supervisor'
import { createProjectImportHandler } from './project-import'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

let mainWindow: BrowserWindow | null = null
let supervisor: RuntimeSupervisor | null = null

// Keep the desktop shell usable on Windows hosts whose GPU process cannot initialize.
app.disableHardwareAcceleration()

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

  // Capture renderer console for diagnostics
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['[R-VERBOSE]','[R-INFO]','[R-WARN]','[R-ERROR]'][level] || '[R-LOG]'
    console.log(`${prefix} ${message}`)
  })
  // Log page load success/failure
  mainWindow.webContents.on('did-finish-load', () => console.log('[Main] Renderer loaded successfully'))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => console.log('[Main] Renderer FAILED:', code, desc))

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
          'X-Harness-Desktop-Version': '0.1.0',
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
        headers: { Authorization: `Bearer ${supervisor.token}`, 'X-Harness-Desktop-Version': '0.1.0' },
      })
      if (resp.ok) return await resp.json()
      return { status: 'unavailable', error: `HTTP ${resp.status}` }
    } catch (err: any) {
      return { status: 'unavailable', error: err.message }
    }
  })

  // ── IPC: Projects ──
  ipcMain.handle('project:list', async () => runtimeCall('project.list'))
  ipcMain.handle('project:import', createProjectImportHandler({
    runtimeCall,
    showOpenDialog: (window, options) => dialog.showOpenDialog(window, options),
    getWindow: () => mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null,
  }))
  ipcMain.handle('project:validate', async (_e, path: string) => runtimeCall('project.validate', { path }))

  // ── IPC: Runs ──
  ipcMain.handle('run:list', async (_e, projectId: string) => runtimeCall('run.list', { projectId }))
  ipcMain.handle('run:create', async (_e, projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.create', { projectId, intent, risk, runId, expectedRevision }))
  ipcMain.handle('run:switch', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.switch', { projectId, runId, expectedRevision }))
  ipcMain.handle('run:pause', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.pause', { projectId, runId, expectedRevision }))
  ipcMain.handle('run:resume', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.resume', { projectId, runId, expectedRevision }))

  // ── IPC: Workflow ──
  ipcMain.handle('workflow:get', async (_e, projectId: string) => runtimeCall('workflow.get', { projectId }))
  ipcMain.handle('workflow:compile', async (_e, projectId: string, intent: string, risk: string) =>
    runtimeCall('workflow.compile', { projectId, intent, risk }))
  ipcMain.handle('workflow:preview', async (_e, projectId: string, nodes: unknown[], intent: string, risk: string, route: string[]) =>
    runtimeCall('workflow.preview', { projectId, nodes, intent, risk, route }))
  ipcMain.handle('workflow:diff', async (_e, projectId: string, yaml: string) =>
    runtimeCall('workflow.diff', { projectId, yaml }))
  ipcMain.handle('workflow:apply', async (_e, projectId: string, yaml: string, hash: string) =>
    runtimeCall('workflow.apply', { projectId, yaml, hash }))

  // ── IPC: Gates ──
  ipcMain.handle('gate:list', async (_e, projectId: string, runId: string) => runtimeCall('gate.list', { projectId, runId }))
  ipcMain.handle('gate:evaluate', async (_e, projectId: string, runId: string, gateId: string, expectedRevision?: string) =>
    runtimeCall('gate.evaluate', { projectId, runId, gateId, expectedRevision }))

  // ── IPC: Artifacts ──
  ipcMain.handle('artifact:list', async (_e, projectId: string, runId: string) => runtimeCall('artifact.list', { projectId, runId }))
  ipcMain.handle('artifact:read', async (_e, projectId: string, runId: string, filename: string) =>
    runtimeCall('artifact.read', { projectId, runId, filename }))

  // ── IPC: Knowledge ──
  ipcMain.handle('knowledge:list', async (_e, projectId: string, status: string) =>
    runtimeCall('knowledge.list', { projectId, status }))
  ipcMain.handle('knowledge:review', async (_e, projectId: string, candidateId: number, decision: string) =>
    runtimeCall('knowledge.review', { projectId, candidateId, decision }))

  // ── IPC: Execution ──
  ipcMain.handle('execution:probe', async (_e, projectId: string) =>
    runtimeCall('execution.probe', { projectId }))
  ipcMain.handle('execution:start', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('execution.start', { projectId, runId, expectedRevision }))
  ipcMain.handle('execution:poll', async (_e, projectId: string, runId: string, sessionId: string) =>
    runtimeCall('execution.poll', { projectId, runId, sessionId }))
  ipcMain.handle('execution:respond', async (_e, projectId: string, runId: string, sessionId: string, decision: unknown) =>
    runtimeCall('execution.respond', { projectId, runId, sessionId, decision }))
  ipcMain.handle('execution:cancel', async (_e, projectId: string, runId: string, sessionId: string) =>
    runtimeCall('execution.cancel', { projectId, runId, sessionId }))

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
