/**
 * Electron Main entry point.
 *
 * Architecture §8.1: Electron Main manages OS capabilities, window creation,
 * and Runtime lifecycle. It does NOT implement Workflow, Run, or Gate logic.
 * Architecture §14: contextIsolation=true, nodeIntegration=false, sandbox=true.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DESKTOP_VERSION, RuntimeSupervisor } from './runtime-supervisor'
import { createProjectImportHandler } from './project-import'
import { AiCliSettingsStore, discoverAiCli, knownClaudeCandidates, knownHermesCandidates, whereClaudeCode, whereCodex } from './codex-discovery'
import { TerminalManager } from './terminal-manager'
import { AppSettingsStore, DEFAULT_APP_SETTINGS, enforcePolicy, type PolicyAction } from './app-settings'
import { probeGithubRelease, publishGithubRelease, type GithubReleaseRequest } from './github-release'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

let mainWindow: BrowserWindow | null = null
let supervisor: RuntimeSupervisor | null = null
let terminalManager: TerminalManager | null = null

// Keep the desktop shell usable on Windows hosts whose GPU process cannot initialize.
app.disableHardwareAcceleration()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b16d8',
    webPreferences: {
      // Architecture §14: security model
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load the renderer
  const rendererDevServerUrl = typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' && MAIN_WINDOW_VITE_DEV_SERVER_URL.length > 0
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL
  if (rendererDevServerUrl) {
    mainWindow.loadURL(rendererDevServerUrl)
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
    void terminalManager?.shutdown()
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
          'X-Harness-Desktop-Version': DESKTOP_VERSION,
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

  async function resolveRegisteredProjectPath(projectId: string): Promise<string> {
    const projects = await runtimeCall('project.list')
    const project = Array.isArray(projects) ? projects.find((item) => item?.projectId === projectId) : undefined
    if (!project?.path) throw new Error(`PROJECT_NOT_FOUND: ${projectId}`)
    return String(project.path)
  }

  const aiCliStore = new AiCliSettingsStore(path.join(app.getPath('userData'), 'ai-cli-settings.json'))
  const appSettingsStore = new AppSettingsStore(path.join(app.getPath('userData'), 'app-settings.json'))
  async function enforceConfiguredPolicy(action: PolicyAction, confirmed?: boolean): Promise<void> {
    enforcePolicy(await appSettingsStore.loadOrDefault(), action, confirmed === true)
  }
  async function discoverConfiguredAiCli(provider: 'codex' | 'claude', userPath?: string): Promise<Record<string, unknown>> {
    const saved = await aiCliStore.load(provider)
    const result = await discoverAiCli({
      provider,
      userPath: userPath || saved?.executablePath,
      environmentPath: provider === 'claude' ? process.env.HARNESS_CLAUDE_PATH : process.env.HARNESS_CODEX_PATH,
      hermesCandidates: provider === 'claude' ? knownClaudeCandidates() : knownHermesCandidates(),
      pathCandidates: provider === 'claude' ? await whereClaudeCode() : await whereCodex(),
    })
    if (result.available && result.path && result.version && result.source) {
      await aiCliStore.save(provider, {
        executablePath: result.path,
        version: result.version,
        lastProbeStatus: 'available',
        lastProbeAt: new Date().toISOString(),
        source: userPath ? 'user' : result.source,
      })
    }
    return result as unknown as Record<string, unknown>
  }

  terminalManager = new TerminalManager({
    getExecutionContext: (projectId, runId) => runtimeCall('run.executionContext', { projectId, runId }),
    resolveExecutable: async (provider) => {
      const result = await discoverConfiguredAiCli(provider)
      if (result.available !== true) throw new Error(String(result.diagnostics || `${provider.toUpperCase()}_UNAVAILABLE`))
      return { path: String(result.path), version: String(result.version) }
    },
    updateProjection: (projectId, session) => runtimeCall('terminal.session.update', { projectId, session }),
    emit: (ownerId, channel, payload) => {
      const target = BrowserWindow.getAllWindows().find((window) => window.webContents.id === ownerId)
      target?.webContents.send(channel, payload)
    },
    logDirectory: path.join(app.getPath('logs'), 'terminals'),
  })

  // ── IPC: Health ──
  ipcMain.handle('runtime:health', async () => {
    if (!supervisor || !supervisor.port) return { status: 'starting' }
    try {
      const resp = await fetch(`http://127.0.0.1:${supervisor.port}/health`, {
        headers: { Authorization: `Bearer ${supervisor.token}`, 'X-Harness-Desktop-Version': DESKTOP_VERSION },
      })
      if (resp.ok) return await resp.json()
      return { status: 'unavailable', error: `HTTP ${resp.status}` }
    } catch (err: any) {
      return { status: 'unavailable', error: err.message }
    }
  })
  ipcMain.handle('app-settings:get', async () => appSettingsStore.load())
  ipcMain.handle('app-settings:set', async (_event, settings: unknown) => appSettingsStore.save(settings))
  ipcMain.handle('app-settings:reset', async () => appSettingsStore.save(DEFAULT_APP_SETTINGS))
  ipcMain.handle('app-settings:export', async () => {
    const settings = await appSettingsStore.loadOrDefault()
    const result = await dialog.showSaveDialog({
      title: 'Export Harness Desktop settings',
      defaultPath: 'harness-desktop-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { error: 'cancelled' }
    await writeFile(result.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    return { success: true, filePath: result.filePath }
  })
  ipcMain.handle('app-settings:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Harness Desktop settings',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { error: 'cancelled' }
    const settings = await appSettingsStore.save(JSON.parse(await readFile(result.filePaths[0], 'utf8')))
    return { success: true, filePath: result.filePaths[0], settings }
  })
  ipcMain.handle('release:probe', async (_event, projectId: string, tag: string) =>
    probeGithubRelease(await resolveRegisteredProjectPath(projectId), tag))
  ipcMain.handle('release:select-assets', async () => {
    const result = await dialog.showOpenDialog({ title: 'Select GitHub Release assets', properties: ['openFile', 'multiSelections'] })
    return result.canceled ? { error: 'cancelled', assets: [] } : { assets: result.filePaths }
  })
  ipcMain.handle('release:publish', async (_event, projectId: string, request: GithubReleaseRequest, policyConfirmed?: boolean) => {
    await enforceConfiguredPolicy('gitPush', policyConfirmed)
    return publishGithubRelease(await resolveRegisteredProjectPath(projectId), request)
  })

  // ── IPC: Projects ──
  ipcMain.handle('project:list', async () => runtimeCall('project.list'))
  ipcMain.handle('project:import', createProjectImportHandler({
    runtimeCall,
    showOpenDialog: (window, options) => dialog.showOpenDialog(window, options),
    showMessageBox: (window, options) => dialog.showMessageBox(window, options),
    getWindow: () => mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null,
  }))
  ipcMain.handle('project:validate', async (_e, path: string) => runtimeCall('project.validate', { path }))
  ipcMain.handle('project:repair', async (_e, projectId: string) => runtimeCall('project.repair', { projectId }))
  ipcMain.handle('project:unregister', async (_e, projectId: string) => runtimeCall('project.unregister', { projectId }))
  ipcMain.handle('project:relocate', async (_e, projectId: string) => {
    const result = await dialog.showOpenDialog({ title: 'Relocate Harness project', properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return { error: 'cancelled' }
    return runtimeCall('project.relocate', { projectId, path: result.filePaths[0] })
  })

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
  ipcMain.handle('run:archive', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.archive', { projectId, runId, expectedRevision }))
  ipcMain.handle('run:merge-back-preflight', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.mergeBackPreflight', { projectId, runId, expectedRevision }))
  ipcMain.handle('run:merge-back', async (_e, projectId: string, runId: string, expectedRevision?: string, policyConfirmed?: boolean) => {
    await enforceConfiguredPolicy('gitCommit', policyConfirmed)
    return runtimeCall('run.mergeBack', { projectId, runId, expectedRevision })
  })
  ipcMain.handle('run:execution-context', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('run.executionContext', { projectId, runId, expectedRevision }))

  // ── IPC: Node decisions ──
  ipcMain.handle('node:complete', async (_e, projectId: string, runId: string, expectedRevision?: string) =>
    runtimeCall('node.complete', { projectId, runId, expectedRevision }))
  ipcMain.handle('node:confirm', async (_e, projectId: string, runId: string, decision: string, comment: string, expectedRevision?: string) =>
    runtimeCall('node.confirm', { projectId, runId, decision, comment, expectedRevision }))
  ipcMain.handle('node:reject', async (_e, projectId: string, runId: string, comment: string, expectedRevision?: string) =>
    runtimeCall('node.reject', { projectId, runId, comment, expectedRevision }))

  // ── IPC: Workflow ──
  ipcMain.handle('workflow:get', async (_e, projectId: string, runId?: string) => runtimeCall('workflow.get', { projectId, runId }))
  ipcMain.handle('workflow:compile', async (_e, projectId: string, intent: string, risk: string) =>
    runtimeCall('workflow.compile', { projectId, intent, risk }))
  ipcMain.handle('workflow:preview', async (_e, projectId: string, nodes: unknown[], intent: string, risk: string, route: string[], options: Record<string, unknown> = {}) =>
    runtimeCall('workflow.preview', { projectId, nodes, intent, risk, route, ...options }))
  ipcMain.handle('workflow:diff', async (_e, projectId: string, yaml: string) =>
    runtimeCall('workflow.diff', { projectId, yaml }))
  ipcMain.handle('workflow:preview-yaml', async (_e, projectId: string, yaml: string) =>
    runtimeCall('workflow.import', { projectId, format: 'yaml', content: yaml }))
  ipcMain.handle('workflow:apply', async (_e, projectId: string, yaml: string, hash: string) =>
    runtimeCall('workflow.apply', { projectId, yaml, hash }))
  ipcMain.handle('workflow:import', async (_event, projectId: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Harness workflow', properties: ['openFile'],
      filters: [{ name: 'Workflow', extensions: ['yaml', 'yml', 'zip'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { error: 'cancelled' }
    const selected = result.filePaths[0]
    const content = await readFile(selected)
    const format = path.extname(selected).toLowerCase() === '.zip' ? 'zip' : 'yaml'
    return runtimeCall('workflow.import', { projectId, format, content: format === 'zip' ? content.toString('base64') : content.toString('utf8') })
  })
  ipcMain.handle('workflow:export', async (_event, projectId: string, format: 'yaml' | 'zip') => {
    const exported = await runtimeCall('workflow.export', { projectId, format })
    if (exported.error || exported.success !== true) return exported
    const result = await dialog.showSaveDialog({ defaultPath: String(exported.filename || `workflow.${format}`) })
    if (result.canceled || !result.filePath) return { error: 'cancelled' }
    await writeFile(result.filePath, Buffer.from(String(exported.content), 'base64'))
    return { success: true, filename: result.filePath, sha256: exported.sha256 }
  })
  ipcMain.handle('workflow:versions', async (_event, projectId: string) => runtimeCall('workflow.versions', { projectId }))
  ipcMain.handle('workflow:restore', async (_event, projectId: string, versionId: number, hash: string) =>
    runtimeCall('workflow.restore', { projectId, versionId, hash }))

  // ── IPC: Gates ──
  ipcMain.handle('gate:list', async (_e, projectId: string, runId: string) => runtimeCall('gate.list', { projectId, runId }))
  ipcMain.handle('gate:evaluate', async (_e, projectId: string, runId: string, gateId: string, expectedRevision?: string) =>
    runtimeCall('gate.evaluate', { projectId, runId, gateId, expectedRevision }))
  ipcMain.handle('gate:waive', async (_e, projectId: string, runId: string, gateId: string, scope: string, reason: string, owner: string, expectedRevision?: string) =>
    runtimeCall('gate.waive', { projectId, runId, gateId, scope, reason, owner, expectedRevision }))

  // ── IPC: Artifacts ──
  ipcMain.handle('artifact:list', async (_e, projectId: string, runId: string) => runtimeCall('artifact.list', { projectId, runId }))
  ipcMain.handle('artifact:read', async (_e, projectId: string, runId: string, filename: string) =>
    runtimeCall('artifact.read', { projectId, runId, filename }))
  ipcMain.handle('artifact:hash', async (_e, projectId: string, runId: string, filename: string) =>
    runtimeCall('artifact.hash', { projectId, runId, filename }))

  // ── IPC: Codex settings and native PTY ──
  ipcMain.handle('codex-settings:get', async () => aiCliStore.load('codex'))
  ipcMain.handle('codex-settings:discover', async () => discoverConfiguredAiCli('codex'))
  ipcMain.handle('codex-settings:set-path', async (_event, executablePath: string) => discoverConfiguredAiCli('codex', executablePath))
  ipcMain.handle('codex-settings:select', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Codex executable', properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined,
    })
    if (result.canceled || !result.filePaths[0]) return { error: 'cancelled' }
    return discoverConfiguredAiCli('codex', result.filePaths[0])
  })
  ipcMain.handle('claude-settings:get', async () => aiCliStore.load('claude'))
  ipcMain.handle('claude-settings:discover', async () => discoverConfiguredAiCli('claude'))
  ipcMain.handle('claude-settings:set-path', async (_event, executablePath: string) => discoverConfiguredAiCli('claude', executablePath))
  ipcMain.handle('claude-settings:select', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Claude Code executable', properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined,
    })
    if (result.canceled || !result.filePaths[0]) return { error: 'cancelled' }
    return discoverConfiguredAiCli('claude', result.filePaths[0])
  })
  ipcMain.handle('terminal:create', async (event, request) => {
    await enforceConfiguredPolicy('commandExecution', request?.policyConfirmed)
    return terminalManager!.create(event.sender.id, request)
  })
  ipcMain.handle('terminal:list', async (_event, projectId: string) => {
    const durable = await runtimeCall('terminal.session.list', { projectId })
    const combined = new Map<string, unknown>((Array.isArray(durable) ? durable : []).map((item: any) => [item.sessionId, item]))
    for (const session of terminalManager!.list(projectId)) combined.set(session.sessionId, session)
    return [...combined.values()]
  })
  ipcMain.handle('terminal:write', async (event, sessionId: string, data: string) => terminalManager!.write(event.sender.id, sessionId, data))
  ipcMain.handle('terminal:scrollback', async (event, sessionId: string) => terminalManager!.readScrollback(event.sender.id, sessionId))
  ipcMain.handle('terminal:resize', async (event, sessionId: string, cols: number, rows: number) => terminalManager!.resize(event.sender.id, sessionId, cols, rows))
  ipcMain.handle('terminal:stop', async (event, sessionId: string) => terminalManager!.stop(event.sender.id, sessionId))
  ipcMain.handle('terminal:restart', async (event, sessionId: string) => terminalManager!.restart(event.sender.id, sessionId))
  ipcMain.handle('diagnostics:export', async (_event, projectId: string) => runtimeCall('diagnostics.export', { projectId }))

  // ── IPC: Knowledge ──
  ipcMain.handle('knowledge:list', async (_e, projectId: string, status: string) =>
    runtimeCall('knowledge.list', { projectId, status }))
  ipcMain.handle('knowledge:review', async (_e, projectId: string, candidateId: number, decision: string) =>
    runtimeCall('knowledge.review', { projectId, candidateId, decision }))
  ipcMain.handle('knowledge:repo-status', async (_e, projectId: string) =>
    runtimeCall('knowledge.repo.status', { projectId }))
  ipcMain.handle('knowledge:repo-configure', async (_e, projectId: string, localPath: string, remoteUrl: string, branch: string) =>
    runtimeCall('knowledge.repo.configure', { projectId, localPath, remoteUrl, branch }))
  ipcMain.handle('knowledge:repo-inspect-local', async (_e, projectId: string, localPath: string) =>
    runtimeCall('knowledge.repo.inspectLocal', { projectId, localPath }))
  ipcMain.handle('knowledge:repo-pull', async (_e, projectId: string) =>
    runtimeCall('knowledge.repo.pull', { projectId }))
  ipcMain.handle('knowledge:repo-synthesize', async (_e, projectId: string, candidateIds: number[]) =>
    runtimeCall('knowledge.repo.synthesize', { projectId, candidateIds }))
  ipcMain.handle('knowledge:repo-codex-start', async (_e, projectId: string, candidateIds: number[], allowDirty?: boolean, policyConfirmed?: boolean, dirtyPolicyConfirmed?: boolean, provider = 'codex') => {
    await enforceConfiguredPolicy('commandExecution', policyConfirmed)
    if (allowDirty) await enforceConfiguredPolicy('dirtyWorktree', dirtyPolicyConfirmed)
    const settings = await appSettingsStore.loadOrDefault()
    const executable = await discoverConfiguredAiCli(provider === 'claude' ? 'claude' : 'codex')
    return runtimeCall('knowledge.repo.codex.start', { projectId, candidateIds, allowDirty, allowRepeat: settings.policy.repeatKnowledgePush, provider, executablePath: executable.path || '' })
  })
  ipcMain.handle('knowledge:repo-codex-active', async (_e, projectId: string) =>
    runtimeCall('knowledge.repo.codex.active', { projectId }))
  ipcMain.handle('knowledge:repo-codex-poll', async (_e, projectId: string, sessionId: string) =>
    runtimeCall('knowledge.repo.codex.poll', { projectId, sessionId }))
  ipcMain.handle('knowledge:repo-codex-respond', async (_e, projectId: string, sessionId: string, decision: unknown) =>
    runtimeCall('knowledge.repo.codex.respond', { projectId, sessionId, decision }))
  ipcMain.handle('knowledge:repo-codex-feedback', async (_e, projectId: string, sessionId: string, feedback: string) =>
    runtimeCall('knowledge.repo.codex.feedback', { projectId, sessionId, feedback }))
  ipcMain.handle('knowledge:repo-codex-cancel', async (_e, projectId: string, sessionId: string) =>
    runtimeCall('knowledge.repo.codex.cancel', { projectId, sessionId }))
  ipcMain.handle('knowledge:repo-push', async (_e, projectId: string, candidateIds: number[], pushConfirmed?: boolean, commitConfirmed?: boolean) => {
    await enforceConfiguredPolicy('gitCommit', commitConfirmed)
    await enforceConfiguredPolicy('gitPush', pushConfirmed)
    const settings = await appSettingsStore.loadOrDefault()
    return runtimeCall('knowledge.repo.push', { projectId, candidateIds, allowRepeat: settings.policy.repeatKnowledgePush })
  })

  // ── IPC: Execution ──
  ipcMain.handle('execution:probe', async (_e, projectId: string, provider = 'codex') => {
    const executable = await discoverConfiguredAiCli(provider === 'claude' ? 'claude' : 'codex')
    return runtimeCall('execution.probe', { projectId, provider, executablePath: executable.path || '' })
  })
  ipcMain.handle('execution:start', async (_e, projectId: string, runId: string, expectedRevision?: string, provider = 'codex', policyConfirmed?: boolean) => {
    await enforceConfiguredPolicy('commandExecution', policyConfirmed)
    const executable = await discoverConfiguredAiCli(provider === 'claude' ? 'claude' : 'codex')
    return runtimeCall('execution.start', { projectId, runId, expectedRevision, provider, executablePath: executable.path || '' })
  })
  ipcMain.handle('execution:poll', async (_e, projectId: string, runId: string, sessionId: string) =>
    runtimeCall('execution.poll', { projectId, runId, sessionId }))
  ipcMain.handle('execution:respond', async (_e, projectId: string, runId: string, sessionId: string, decision: unknown) =>
    runtimeCall('execution.respond', { projectId, runId, sessionId, decision }))
  ipcMain.handle('execution:cancel', async (_e, projectId: string, runId: string, sessionId: string) =>
    runtimeCall('execution.cancel', { projectId, runId, sessionId }))

  // ── IPC: Recovery ──
  ipcMain.handle('recovery:scan', async (_e, projectId: string) => runtimeCall('recovery.scan', { projectId }))
  ipcMain.handle('recovery:cleanup', async (_e, projectId: string) => runtimeCall('recovery.cleanup', { projectId }))
  ipcMain.handle('recovery:archive', async (_e, projectId: string, sessionId: string) => runtimeCall('recovery.archive', { projectId, sessionId }))

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
  void terminalManager?.shutdown().finally(() => supervisor?.shutdown())
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
