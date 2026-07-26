import { execFile } from 'node:child_process'
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type AiCliProvider = 'codex' | 'claude'
export type AiCliSource = 'user' | 'environment' | 'hermes' | 'path'

export interface AiCliProbeResult { version: string }
export interface AiCliAttempt { path: string; source: AiCliSource; ok: boolean; detail: string }
export interface AiCliDiscoveryResult {
  available: boolean
  path?: string
  version?: string
  source?: AiCliSource
  attempts: AiCliAttempt[]
  diagnostics: string
}

interface DiscoveryOptions {
  provider?: AiCliProvider
  userPath?: string
  environmentPath?: string
  hermesCandidates?: string[]
  pathCandidates?: string[]
  probe?: (candidate: string) => Promise<AiCliProbeResult | undefined>
}

export interface AiCliSettings {
  executablePath: string
  version: string
  lastProbeStatus: 'available' | 'unavailable'
  lastProbeAt: string
  source: AiCliSource
}

export type CodexSettings = AiCliSettings

export async function discoverCodex(options: DiscoveryOptions): Promise<AiCliDiscoveryResult> {
  return discoverAiCli({ ...options, provider: 'codex' })
}

export async function discoverAiCli(options: DiscoveryOptions): Promise<AiCliDiscoveryResult> {
  const provider = options.provider || 'codex'
  const candidates: Array<{ path: string; source: AiCliSource }> = []
  if (options.userPath) candidates.push({ path: options.userPath, source: 'user' })
  if (options.environmentPath) candidates.push({ path: options.environmentPath, source: 'environment' })
  for (const candidate of options.hermesCandidates || []) candidates.push({ path: candidate, source: 'hermes' })
  for (const candidate of options.pathCandidates || []) candidates.push({ path: candidate, source: 'path' })
  const seen = new Set<string>()
  const attempts: AiCliAttempt[] = []
  const probe = options.probe || (provider === 'claude' ? probeClaudeCode : probeCodex)
  const validPattern = provider === 'claude'
    ? /\bclaude(?:-code)?\s+v?\d+\.\d+(?:\.\d+)?/i
    : /\bcodex(?:-cli)?\s+v?\d+\.\d+(?:\.\d+)?/i

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate.path).toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    try {
      const result = await probe(candidate.path)
      const version = result?.version?.trim() || ''
      const valid = validPattern.test(version)
      attempts.push({ path: candidate.path, source: candidate.source, ok: valid, detail: valid ? version : 'Invalid version output' })
      if (valid) {
        return { available: true, path: path.resolve(candidate.path), version, source: candidate.source, attempts, diagnostics: '' }
      }
    } catch (cause) {
      attempts.push({ path: candidate.path, source: candidate.source, ok: false, detail: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  return {
    available: false,
    attempts,
    diagnostics: provider === 'claude'
      ? 'No valid Claude Code candidate passed claude --version'
      : 'No valid Codex CLI candidate passed codex --version',
  }
}

export async function probeCodex(candidate: string): Promise<AiCliProbeResult | undefined> {
  const absolute = path.resolve(candidate)
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Codex executable must be a regular file')
  return new Promise((resolve, reject) => {
    execFile(absolute, ['--version'], { windowsHide: true, timeout: 5000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error((stderr || error.message).trim()))
      resolve({ version: String(stdout || stderr).trim() })
    })
  })
}

export async function probeClaudeCode(candidate: string): Promise<AiCliProbeResult | undefined> {
  const absolute = path.resolve(candidate)
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Claude Code executable must be a regular file')
  return new Promise((resolve, reject) => {
    execFile(absolute, ['--version'], { windowsHide: true, timeout: 5000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error((stderr || error.message).trim()))
      resolve({ version: String(stdout || stderr).trim() })
    })
  })
}

export async function whereCodex(): Promise<string[]> {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    execFile(command, ['codex'], { windowsHide: true, timeout: 5000 }, (_error, stdout) => {
      resolve(String(stdout || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean))
    })
  })
}

export async function whereClaudeCode(): Promise<string[]> {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    execFile(command, ['claude'], { windowsHide: true, timeout: 5000 }, (_error, stdout) => {
      resolve(String(stdout || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean))
    })
  })
}

export function knownHermesCandidates(environment: NodeJS.ProcessEnv = process.env): string[] {
  const roots = [environment.LOCALAPPDATA, environment.APPDATA]
    .filter((value): value is string => Boolean(value))
    .flatMap((root) => [
      path.join(root, 'hermes', 'codex.exe'),
      path.join(root, 'hermes', 'vendor', 'codex.exe'),
      path.join(root, 'Hermes', 'resources', 'vendor', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-arm64', 'vendor', 'aarch64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex-win32-arm64', 'vendor', 'aarch64-pc-windows-msvc', 'bin', 'codex.exe'),
    ])
  return [...new Set(roots)]
}

export function knownClaudeCandidates(environment: NodeJS.ProcessEnv = process.env): string[] {
  const roots = [environment.LOCALAPPDATA, environment.APPDATA]
    .filter((value): value is string => Boolean(value))
    .flatMap((root) => [
      path.join(root, 'Claude', 'claude.exe'),
      path.join(root, 'claude', 'claude.exe'),
      path.join(root, 'Anthropic', 'Claude', 'claude.exe'),
    ])
  return [...new Set(roots)]
}

export class CodexSettingsStore {
  constructor(private readonly settingsPath: string) {}

  async load(): Promise<CodexSettings | undefined> {
    try {
      return JSON.parse(await readFile(this.settingsPath, 'utf8')) as CodexSettings
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return undefined
      throw cause
    }
  }

  async save(settings: CodexSettings): Promise<void> {
    await mkdir(path.dirname(this.settingsPath), { recursive: true })
    const temporary = `${this.settingsPath}.tmp`
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    await rename(temporary, this.settingsPath)
  }
}

export class AiCliSettingsStore {
  constructor(private readonly settingsPath: string) {}

  async load(provider: AiCliProvider): Promise<AiCliSettings | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Record<string, AiCliSettings>
      return parsed[provider]
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return undefined
      throw cause
    }
  }

  async save(provider: AiCliProvider, settings: AiCliSettings): Promise<void> {
    await mkdir(path.dirname(this.settingsPath), { recursive: true })
    const current = await this.readAll()
    current[provider] = settings
    const temporary = `${this.settingsPath}.tmp`
    await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
    await rename(temporary, this.settingsPath)
  }

  private async readAll(): Promise<Record<string, AiCliSettings>> {
    try {
      return JSON.parse(await readFile(this.settingsPath, 'utf8')) as Record<string, AiCliSettings>
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return {}
      throw cause
    }
  }
}
