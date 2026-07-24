import { execFile } from 'node:child_process'
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type CodexSource = 'user' | 'environment' | 'hermes' | 'path'

export interface CodexProbeResult { version: string }
export interface CodexAttempt { path: string; source: CodexSource; ok: boolean; detail: string }
export interface CodexDiscoveryResult {
  available: boolean
  path?: string
  version?: string
  source?: CodexSource
  attempts: CodexAttempt[]
  diagnostics: string
}

interface DiscoveryOptions {
  userPath?: string
  environmentPath?: string
  hermesCandidates?: string[]
  pathCandidates?: string[]
  probe?: (candidate: string) => Promise<CodexProbeResult | undefined>
}

export interface CodexSettings {
  executablePath: string
  version: string
  lastProbeStatus: 'available' | 'unavailable'
  lastProbeAt: string
  source: CodexSource
}

export async function discoverCodex(options: DiscoveryOptions): Promise<CodexDiscoveryResult> {
  const candidates: Array<{ path: string; source: CodexSource }> = []
  if (options.userPath) candidates.push({ path: options.userPath, source: 'user' })
  if (options.environmentPath) candidates.push({ path: options.environmentPath, source: 'environment' })
  for (const candidate of options.hermesCandidates || []) candidates.push({ path: candidate, source: 'hermes' })
  for (const candidate of options.pathCandidates || []) candidates.push({ path: candidate, source: 'path' })
  const seen = new Set<string>()
  const attempts: CodexAttempt[] = []
  const probe = options.probe || probeCodex

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate.path).toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    try {
      const result = await probe(candidate.path)
      const version = result?.version?.trim() || ''
      const valid = /\bcodex(?:-cli)?\s+v?\d+\.\d+(?:\.\d+)?/i.test(version)
      attempts.push({ path: candidate.path, source: candidate.source, ok: valid, detail: valid ? version : 'Invalid version output' })
      // 每个候选独立探测；WindowsApps 拒绝访问不能阻止后续 Hermes/PATH 候选。
      if (valid) {
        return { available: true, path: path.resolve(candidate.path), version, source: candidate.source, attempts, diagnostics: '' }
      }
    } catch (cause) {
      attempts.push({ path: candidate.path, source: candidate.source, ok: false, detail: cause instanceof Error ? cause.message : String(cause) })
    }
  }
  return { available: false, attempts, diagnostics: 'No valid Codex CLI candidate passed codex --version' }
}

export async function probeCodex(candidate: string): Promise<CodexProbeResult | undefined> {
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

export async function whereCodex(): Promise<string[]> {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  return new Promise((resolve) => {
    execFile(command, ['codex'], { windowsHide: true, timeout: 5000 }, (_error, stdout) => {
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
      // Hermes 的 PATH shim 是 shell/cmd 脚本；Main 必须定位普通 vendor 文件后直接启动。
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-arm64', 'vendor', 'aarch64-pc-windows-msvc', 'bin', 'codex.exe'),
      path.join(root, 'hermes', 'node', 'node_modules', '@openai', 'codex-win32-arm64', 'vendor', 'aarch64-pc-windows-msvc', 'bin', 'codex.exe'),
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
