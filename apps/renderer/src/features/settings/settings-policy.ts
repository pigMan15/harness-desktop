export type AiProvider = 'codex' | 'claude'
export type ProfileId = string
export type PolicyLevel = 'ask' | 'allow' | 'block'
export type AppLanguage = 'zh-CN' | 'en-US'

export interface LocalSettings {
  language: AppLanguage
  defaultProvider: AiProvider
  profile: ProfileId
  customProfiles: Array<{ id: string; title: string; summary: string; policy: Partial<LocalSettings['policy']> }>
  codexPath: string
  claudePath: string
  releaseTagPrefix: string
  releaseDraft: boolean
  overwriteReleaseAssets: boolean
  policy: {
    commandExecution: PolicyLevel
    gitCommit: PolicyLevel
    gitPush: PolicyLevel
    dirtyWorktree: PolicyLevel
    repeatKnowledgePush: boolean
  }
}

export interface PolicyAuthorization {
  allowed: boolean
  blocked: boolean
}

export const SETTINGS_STORAGE_KEY = 'harness.settings.v1'

export const DEFAULT_SETTINGS: LocalSettings = {
  language: 'zh-CN',
  defaultProvider: 'codex',
  profile: 'strict-harness',
  customProfiles: [],
  codexPath: '',
  claudePath: '',
  releaseTagPrefix: 'v',
  releaseDraft: false,
  overwriteReleaseAssets: true,
  policy: {
    commandExecution: 'ask',
    gitCommit: 'ask',
    gitPush: 'ask',
    dirtyWorktree: 'block',
    repeatKnowledgePush: true,
  },
}

export function loadLocalSettings(storage: Pick<Storage, 'getItem'> = window.localStorage): LocalSettings {
  try {
    const parsed = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) || '') as Partial<LocalSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      language: parsed.language === 'en-US' ? 'en-US' : 'zh-CN',
      customProfiles: Array.isArray(parsed.customProfiles) ? parsed.customProfiles : [],
      policy: { ...DEFAULT_SETTINGS.policy, ...parsed.policy },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function authorizePolicy(
  level: PolicyLevel,
  confirmation: string,
  confirmAction: (message: string) => boolean = window.confirm,
): PolicyAuthorization {
  if (level === 'block') return { allowed: false, blocked: true }
  if (level === 'ask') return { allowed: confirmAction(confirmation), blocked: false }
  return { allowed: true, blocked: false }
}

export function policyBlockedMessage(action: string): string {
  return `${action} is blocked by Settings > Policy Engine.`
}
