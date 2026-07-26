import { describe, expect, it } from 'vitest'
import { AppSettingsStore, DEFAULT_APP_SETTINGS, enforcePolicy, normalizeAppSettings } from '../src/main/app-settings'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('desktop app settings', () => {
  it('normalizes malformed policy values', () => {
    const settings = normalizeAppSettings({ defaultProvider: 'claude', policy: { gitPush: 'invalid', commandExecution: 'allow' } })
    expect(settings.defaultProvider).toBe('claude')
    expect(settings.policy.commandExecution).toBe('allow')
    expect(settings.policy.gitPush).toBe(DEFAULT_APP_SETTINGS.policy.gitPush)
    expect(settings.language).toBe('zh-CN')
  })

  it('normalizes supported interface languages', () => {
    expect(normalizeAppSettings({ language: 'en-US' }).language).toBe('en-US')
    expect(normalizeAppSettings({ language: 'invalid' }).language).toBe('zh-CN')
  })

  it('enforces allow, ask, and block in the main process', () => {
    expect(() => enforcePolicy({ ...DEFAULT_APP_SETTINGS, policy: { ...DEFAULT_APP_SETTINGS.policy, gitPush: 'allow' } }, 'gitPush')).not.toThrow()
    expect(() => enforcePolicy(DEFAULT_APP_SETTINGS, 'gitPush')).toThrow('POLICY_CONFIRMATION_REQUIRED')
    expect(() => enforcePolicy(DEFAULT_APP_SETTINGS, 'gitPush', true)).not.toThrow()
    expect(() => enforcePolicy({ ...DEFAULT_APP_SETTINGS, policy: { ...DEFAULT_APP_SETTINGS.policy, gitPush: 'block' } }, 'gitPush', true)).toThrow('POLICY_BLOCKED')
  })

  it('persists normalized settings atomically', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'harness-app-settings-'))
    const store = new AppSettingsStore(path.join(directory, 'settings.json'))
    await store.save({ profile: 'knowledge', policy: { repeatKnowledgePush: false } })
    expect(await store.load()).toMatchObject({ profile: 'knowledge', policy: { repeatKnowledgePush: false } })
  })
})
