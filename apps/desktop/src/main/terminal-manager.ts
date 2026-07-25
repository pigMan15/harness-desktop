import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import type { IDisposable, IPty } from 'node-pty'
import * as nodePty from 'node-pty'

export type TerminalStatus = 'starting' | 'running' | 'exited' | 'failed' | 'stopped' | 'interrupted'

export interface PtyProcess {
  pid: number
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(callback: (data: string) => void): IDisposable
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): IDisposable
}

export interface TerminalCreateRequest {
  projectId: string
  runId: string
  kind: 'codex' | 'shell'
  cols: number
  rows: number
}

export interface TerminalSessionSummary {
  sessionId: string
  projectId: string
  runId: string
  nodeId: string
  kind: 'codex' | 'shell'
  executablePath: string
  cwd: string
  pid?: number
  status: TerminalStatus
  startedAt: string
  endedAt?: string
  exitCode?: number
  cols: number
  rows: number
  sequence: number
  summary: string
}

interface ManagedSession extends TerminalSessionSummary {
  ownerId: number
  pty: PtyProcess
  scrollback: string
  logPath?: string
  logWrite: Promise<void>
}

interface PtySpawnOptions {
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}

interface TerminalManagerDependencies {
  getExecutionContext: (projectId: string, runId: string) => Promise<Record<string, unknown>>
  resolveExecutable: () => Promise<{ path: string; version: string }>
  spawnPty?: (executable: string, args: string[], options: PtySpawnOptions) => PtyProcess
  updateProjection: (projectId: string, session: TerminalSessionSummary) => Promise<unknown>
  emit: (ownerId: number, channel: 'terminal:data' | 'terminal:exit' | 'terminal:status', payload: Record<string, unknown>) => void
  now?: () => string
  randomId?: () => string
  projectLimit?: number
  globalLimit?: number
  scrollbackLimit?: number
  logDirectory?: string
  logFileLimit?: number
}

export class TerminalManager {
  private readonly sessions = new Map<string, ManagedSession>()
  private readonly now: () => string
  private readonly randomId: () => string
  private readonly projectLimit: number
  private readonly globalLimit: number
  private readonly scrollbackLimit: number
  private readonly logDirectory?: string
  private readonly logFileLimit: number

  constructor(private readonly dependencies: TerminalManagerDependencies) {
    this.now = dependencies.now || (() => new Date().toISOString())
    this.randomId = dependencies.randomId || randomUUID
    this.projectLimit = dependencies.projectLimit || 4
    this.globalLimit = dependencies.globalLimit || 8
    this.scrollbackLimit = dependencies.scrollbackLimit || 1024 * 1024
    this.logDirectory = dependencies.logDirectory
    this.logFileLimit = dependencies.logFileLimit || 5 * 1024 * 1024
  }

  async create(ownerId: number, request: TerminalCreateRequest): Promise<TerminalSessionSummary> {
    const context = await this.dependencies.getExecutionContext(request.projectId, request.runId)
    if (context.terminalAllowed !== true) throw new Error(String(context.terminalBlockReason || 'TERMINAL_NOT_ALLOWED'))
    if (String(context.runId || '') !== request.runId) throw new Error('TERMINAL_CONTEXT_RUN_MISMATCH')
    const nodeId = String(context.currentNode || '')
    const cwd = String(context.worktreePath || '')
    if (!nodeId || !cwd) throw new Error('TERMINAL_CONTEXT_INCOMPLETE')
    if ([...this.sessions.values()].some((session) => isActive(session.status)
      && session.projectId === request.projectId && session.runId === request.runId && session.nodeId === nodeId)) {
      throw new Error('TERMINAL_SESSION_ALREADY_ACTIVE')
    }
    const active = [...this.sessions.values()].filter((session) => isActive(session.status))
    if (active.length >= this.globalLimit) throw new Error('TERMINAL_GLOBAL_LIMIT')
    if (active.filter((session) => session.projectId === request.projectId).length >= this.projectLimit) {
      throw new Error('TERMINAL_PROJECT_LIMIT')
    }
    const executable = request.kind === 'codex'
      ? await this.dependencies.resolveExecutable()
      : { path: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/sh'), version: '' }
    const sessionId = this.randomId()
    const startedAt = this.now()
    const summary: ManagedSession = {
      sessionId, projectId: request.projectId, runId: request.runId, nodeId,
      kind: request.kind, executablePath: executable.path, cwd, status: 'starting',
      startedAt, cols: clamp(request.cols, 20, 500), rows: clamp(request.rows, 5, 200),
      sequence: 0, summary: '', ownerId, pty: undefined as unknown as PtyProcess, scrollback: '',
      logPath: this.logDirectory ? path.join(this.logDirectory, `${sessionId}.log`) : undefined,
      logWrite: Promise.resolve(),
    }
    const environment = controlledEnvironment(request, context)
    const spawn = this.dependencies.spawnPty || ((file, args, options) => nodePty.spawn(file, args, windowsPtyOptions(options)) as IPty)
    // executable 与 cwd 均来自 Main/Runtime，Renderer 只能选择 codex 或受控 shell 类型。
    summary.pty = spawn(executable.path, [], { cwd, env: environment, cols: summary.cols, rows: summary.rows })
    summary.pid = summary.pty.pid
    summary.status = 'running'
    this.sessions.set(sessionId, summary)
    summary.pty.onData((data) => this.onData(summary, data))
    summary.pty.onExit((event) => void this.onExit(summary, event.exitCode))
    await this.persistAndEmit(summary, 'terminal:status')
    return publicSummary(summary)
  }

  list(projectId: string): TerminalSessionSummary[] {
    return [...this.sessions.values()].filter((session) => session.projectId === projectId).map(publicSummary)
  }

  readScrollback(ownerId: number, sessionId: string): { data: string; sequence: number; missing?: boolean } {
    const session = this.maybeOwned(ownerId, sessionId)
    if (!session) return { data: '', sequence: 0, missing: true }
    return { data: session.scrollback, sequence: session.sequence }
  }

  write(ownerId: number, sessionId: string, data: string): void {
    const session = this.maybeOwned(ownerId, sessionId)
    if (!session) return
    if (!isActive(session.status)) throw new Error('TERMINAL_SESSION_NOT_ACTIVE')
    if (Buffer.byteLength(data, 'utf8') > 64 * 1024) throw new Error('TERMINAL_INPUT_TOO_LARGE')
    session.pty.write(data)
  }

  resize(ownerId: number, sessionId: string, cols: number, rows: number): void {
    const session = this.maybeOwned(ownerId, sessionId)
    if (!session) return
    session.cols = clamp(cols, 20, 500)
    session.rows = clamp(rows, 5, 200)
    session.pty.resize(session.cols, session.rows)
  }

  async stop(ownerId: number, sessionId: string): Promise<TerminalSessionSummary> {
    const session = this.owned(ownerId, sessionId)
    const active = isActive(session.status)
    session.status = 'stopped'
    session.endedAt = this.now()
    // 先写入终态再终止进程，防止同步 exit 回调覆盖用户主动停止语义。
    if (active) session.pty.kill()
    await session.logWrite
    await this.persistAndEmit(session, 'terminal:status')
    return publicSummary(session)
  }

  async restart(ownerId: number, sessionId: string): Promise<TerminalSessionSummary> {
    const previous = this.owned(ownerId, sessionId)
    await this.stop(ownerId, sessionId)
    return this.create(ownerId, {
      projectId: previous.projectId, runId: previous.runId, kind: previous.kind,
      cols: previous.cols, rows: previous.rows,
    })
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.sessions.values()].filter((session) => isActive(session.status)).map(async (session) => {
      session.status = 'interrupted'
      session.endedAt = this.now()
      // 应用退出只中断终端投影，不得把进程退出误当成 Harness 节点完成。
      session.pty.kill()
      await session.logWrite
      await this.persistAndEmit(session, 'terminal:status')
    }))
  }

  private owned(ownerId: number, sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('TERMINAL_SESSION_NOT_FOUND')
    if (session.ownerId !== ownerId) throw new Error('TERMINAL_SESSION_OWNER_MISMATCH')
    return session
  }

  private maybeOwned(ownerId: number, sessionId: string): ManagedSession | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    if (session.ownerId !== ownerId) throw new Error('TERMINAL_SESSION_OWNER_MISMATCH')
    return session
  }

  private onData(session: ManagedSession, data: string): void {
    session.sequence += 1
    session.scrollback = `${session.scrollback}${data}`.slice(-this.scrollbackLimit)
    if (session.logPath) {
      session.logWrite = session.logWrite.then(() => appendRotatingLog(session.logPath!, data, this.logFileLimit)).catch(() => undefined)
    }
    this.dependencies.emit(session.ownerId, 'terminal:data', {
      sessionId: session.sessionId, projectId: session.projectId, runId: session.runId,
      nodeId: session.nodeId, sequence: session.sequence, data,
    })
  }

  private async onExit(session: ManagedSession, exitCode: number): Promise<void> {
    if (session.status === 'stopped' || session.status === 'interrupted') return
    session.status = exitCode === 0 ? 'exited' : 'failed'
    session.exitCode = exitCode
    session.endedAt = this.now()
    await this.persistAndEmit(session, 'terminal:exit')
  }

  private async persistAndEmit(session: ManagedSession, channel: 'terminal:exit' | 'terminal:status'): Promise<void> {
    const summary = publicSummary(session)
    await this.dependencies.updateProjection(session.projectId, summary)
    this.dependencies.emit(session.ownerId, channel, summary as unknown as Record<string, unknown>)
  }
}

function controlledEnvironment(request: TerminalCreateRequest, context: Record<string, unknown>): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && !/^(HARNESS_RUNTIME_TOKEN|HARNESS_DB_PATH)$/i.test(key)) environment[key] = value
  }
  return {
    ...environment,
    HARNESS_PROJECT_ID: request.projectId,
    HARNESS_RUN_ID: request.runId,
    HARNESS_NODE_ID: String(context.currentNode || ''),
    HARNESS_PHASE_DIR: String(context.phaseDir || ''),
  }
}

function publicSummary(session: ManagedSession): TerminalSessionSummary {
  const { ownerId: _ownerId, pty: _pty, scrollback, logPath: _logPath, logWrite: _logWrite, ...summary } = session
  return { ...summary, summary: redact(scrollback).slice(-2000) }
}

function redact(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
}

function isActive(status: TerminalStatus): boolean { return status === 'starting' || status === 'running' }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Math.floor(value || min))) }

export function windowsPtyOptions(
  options: PtySpawnOptions,
  platform: NodeJS.Platform = process.platform,
): PtySpawnOptions & { useConptyDll?: boolean } {
  // Windows 系统 ConPTY 的 kill 辅助进程在打包宿主中可能无法 AttachConsole；随包 DLL 路径可直接关闭会话句柄。
  return platform === 'win32' ? { ...options, useConptyDll: true } : options
}

async function appendRotatingLog(logPath: string, data: string, limit: number): Promise<void> {
  await mkdir(path.dirname(logPath), { recursive: true })
  await appendFile(logPath, data, 'utf8')
  if ((await stat(logPath)).size <= limit) return
  const rotated = `${logPath}.1`
  // 原始日志只在 AppData 保留一代轮转，诊断导出仍只读取脱敏后的 session summary。
  await rm(rotated, { force: true })
  await rename(logPath, rotated)
}
