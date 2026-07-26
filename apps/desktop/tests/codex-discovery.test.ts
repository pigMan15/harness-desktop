import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AiCliSettingsStore, CodexSettingsStore, discoverCodex, knownHermesCandidates } from '../src/main/codex-discovery'

describe('Codex discovery', () => {
  it('continues after an inaccessible WindowsApps candidate', async () => {
    const probe = vi.fn(async (path: string) => {
      if (path.includes('WindowsApps')) throw new Error('Access is denied')
      return path.includes('hermes')
        ? { version: 'codex-cli 0.145.0' }
        : undefined
    })

    const result = await discoverCodex({
      userPath: 'C:/Users/test/AppData/Local/Microsoft/WindowsApps/codex.exe',
      environmentPath: '',
      hermesCandidates: ['C:/tools/hermes/vendor/codex.exe'],
      pathCandidates: ['C:/tools/codex.exe'],
      probe,
    })

    expect(result.available).toBe(true)
    expect(result.path).toContain('hermes')
    expect(result.source).toBe('hermes')
    expect(result.attempts).toHaveLength(2)
  })

  it('deduplicates candidates and rejects malformed version output', async () => {
    const probe = vi.fn(async () => ({ version: 'not-the-cli' }))

    const result = await discoverCodex({
      environmentPath: 'C:/same/codex.exe',
      hermesCandidates: ['C:/same/codex.exe'],
      pathCandidates: ['C:/same/codex.exe'],
      probe,
    })

    expect(result.available).toBe(false)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(result.diagnostics).toContain('No valid Codex CLI')
  })

  it('enumerates the actual Hermes npm vendor binary instead of command shims', () => {
    const localAppData = 'C:/Users/test/AppData/Local'

    expect(knownHermesCandidates({ LOCALAPPDATA: localAppData })).toContain(path.join(
      localAppData,
      'hermes',
      'node',
      'node_modules',
      '@openai',
      'codex',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    ))
  })

  it('persists settings atomically outside the project workspace', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'harness-codex-settings-'))
    const settingsPath = path.join(directory, 'codex-settings.json')
    const store = new CodexSettingsStore(settingsPath)
    await store.save({ executablePath: 'C:/tools/codex.exe', version: 'codex-cli 0.145.0', lastProbeStatus: 'available', lastProbeAt: '2026-07-24T00:00:00Z', source: 'user' })

    expect(await store.load()).toMatchObject({ executablePath: 'C:/tools/codex.exe', source: 'user' })
    expect(JSON.parse(await readFile(settingsPath, 'utf8')).version).toContain('0.145.0')
  })

  it('keeps Codex and Claude Code paths in the provider-aware store', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'harness-ai-cli-settings-'))
    const settingsPath = path.join(directory, 'ai-cli-settings.json')
    const store = new AiCliSettingsStore(settingsPath)
    await store.save('codex', { executablePath: 'C:/tools/codex.exe', version: 'codex-cli 0.145.0', lastProbeStatus: 'available', lastProbeAt: '2026-07-26T00:00:00Z', source: 'user' })
    await store.save('claude', { executablePath: 'C:/tools/claude.exe', version: 'claude 1.2.3', lastProbeStatus: 'available', lastProbeAt: '2026-07-26T00:00:00Z', source: 'user' })

    expect((await store.load('codex'))?.executablePath).toContain('codex.exe')
    expect((await store.load('claude'))?.executablePath).toContain('claude.exe')
  })
})
