import { describe, expect, it, vi } from 'vitest'
import { authorizePolicy, DEFAULT_SETTINGS, loadLocalSettings, SETTINGS_STORAGE_KEY } from './settings-policy'

describe('settings policy', () => {
  it('merges stored policy values with defaults', () => {
    const storage = { getItem: vi.fn((key: string) => key === SETTINGS_STORAGE_KEY ? JSON.stringify({ policy: { gitPush: 'block' } }) : null) }
    const settings = loadLocalSettings(storage)
    expect(settings.policy.gitPush).toBe('block')
    expect(settings.policy.commandExecution).toBe(DEFAULT_SETTINGS.policy.commandExecution)
    expect(settings.language).toBe('zh-CN')
  })

  it('normalizes the persisted interface language', () => {
    expect(loadLocalSettings({ getItem: () => JSON.stringify({ language: 'en-US' }) }).language).toBe('en-US')
    expect(loadLocalSettings({ getItem: () => JSON.stringify({ language: 'invalid' }) }).language).toBe('zh-CN')
  })

  it('falls back to defaults for invalid storage', () => {
    expect(loadLocalSettings({ getItem: () => '{invalid' })).toEqual(DEFAULT_SETTINGS)
  })

  it('enforces allow, ask, and block decisions', () => {
    const confirmAction = vi.fn(() => true)
    expect(authorizePolicy('allow', 'run', confirmAction)).toEqual({ allowed: true, blocked: false })
    expect(authorizePolicy('ask', 'run', confirmAction)).toEqual({ allowed: true, blocked: false })
    expect(authorizePolicy('block', 'run', confirmAction)).toEqual({ allowed: false, blocked: true })
    expect(confirmAction).toHaveBeenCalledTimes(1)
  })
})
