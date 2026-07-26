import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type PolicyLevel = 'ask' | 'allow' | 'block'
export type PolicyAction = 'commandExecution' | 'gitCommit' | 'gitPush' | 'dirtyWorktree'

export interface DesktopAppSettings {
  language: 'zh-CN' | 'en-US'
  defaultProvider: 'codex' | 'claude'
  profile: string
  customProfiles: Array<{ id: string; title: string; summary: string; policy: Partial<Record<PolicyAction, PolicyLevel> & { repeatKnowledgePush: boolean }> }>
  codexPath: string
  claudePath: string
  releaseTagPrefix: string
  releaseDraft: boolean
  overwriteReleaseAssets: boolean
  policy: Record<PolicyAction, PolicyLevel> & { repeatKnowledgePush: boolean }
}

export const DEFAULT_APP_SETTINGS: DesktopAppSettings = {
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

const POLICY_LEVELS = new Set<PolicyLevel>(['ask', 'allow', 'block'])

export function normalizeAppSettings(value: unknown): DesktopAppSettings {
  const input = value && typeof value === 'object' ? value as Partial<DesktopAppSettings> : {}
  const policy: Partial<DesktopAppSettings['policy']> = input.policy && typeof input.policy === 'object'
    ? input.policy
    : {}
  const level = (key: PolicyAction): PolicyLevel => POLICY_LEVELS.has(policy[key] as PolicyLevel)
    ? policy[key] as PolicyLevel
    : DEFAULT_APP_SETTINGS.policy[key]
  return {
    language: input.language === 'en-US' ? 'en-US' : 'zh-CN',
    defaultProvider: input.defaultProvider === 'claude' ? 'claude' : 'codex',
    profile: typeof input.profile === 'string' && input.profile.trim() ? input.profile : DEFAULT_APP_SETTINGS.profile,
    customProfiles: Array.isArray(input.customProfiles)
      ? input.customProfiles.flatMap((profile) => {
        if (!profile || typeof profile !== 'object') return []
        const candidate = profile as DesktopAppSettings['customProfiles'][number]
        if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') return []
        const customPolicy = candidate.policy && typeof candidate.policy === 'object' ? candidate.policy : {}
        const normalizedPolicy: DesktopAppSettings['customProfiles'][number]['policy'] = {}
        for (const key of ['commandExecution', 'gitCommit', 'gitPush', 'dirtyWorktree'] as PolicyAction[]) {
          if (POLICY_LEVELS.has(customPolicy[key] as PolicyLevel)) normalizedPolicy[key] = customPolicy[key] as PolicyLevel
        }
        if (typeof customPolicy.repeatKnowledgePush === 'boolean') normalizedPolicy.repeatKnowledgePush = customPolicy.repeatKnowledgePush
        return [{ id: candidate.id, title: candidate.title, summary: typeof candidate.summary === 'string' ? candidate.summary : '', policy: normalizedPolicy }]
      })
      : [],
    codexPath: typeof input.codexPath === 'string' ? input.codexPath : '',
    claudePath: typeof input.claudePath === 'string' ? input.claudePath : '',
    releaseTagPrefix: typeof input.releaseTagPrefix === 'string' ? input.releaseTagPrefix : DEFAULT_APP_SETTINGS.releaseTagPrefix,
    releaseDraft: typeof input.releaseDraft === 'boolean' ? input.releaseDraft : DEFAULT_APP_SETTINGS.releaseDraft,
    overwriteReleaseAssets: typeof input.overwriteReleaseAssets === 'boolean' ? input.overwriteReleaseAssets : DEFAULT_APP_SETTINGS.overwriteReleaseAssets,
    policy: {
      commandExecution: level('commandExecution'),
      gitCommit: level('gitCommit'),
      gitPush: level('gitPush'),
      dirtyWorktree: level('dirtyWorktree'),
      repeatKnowledgePush: typeof policy.repeatKnowledgePush === 'boolean'
        ? policy.repeatKnowledgePush
        : DEFAULT_APP_SETTINGS.policy.repeatKnowledgePush,
    },
  }
}

export function enforcePolicy(settings: DesktopAppSettings, action: PolicyAction, confirmed = false): void {
  const level = settings.policy[action]
  if (level === 'block') throw new Error(`POLICY_BLOCKED: ${action}`)
  if (level === 'ask' && !confirmed) throw new Error(`POLICY_CONFIRMATION_REQUIRED: ${action}`)
}

export class AppSettingsStore {
  constructor(private readonly settingsPath: string) {}

  async load(): Promise<DesktopAppSettings | undefined> {
    try {
      return normalizeAppSettings(JSON.parse(await readFile(this.settingsPath, 'utf8')))
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw cause
    }
  }

  async loadOrDefault(): Promise<DesktopAppSettings> {
    return await this.load() || DEFAULT_APP_SETTINGS
  }

  async save(value: unknown): Promise<DesktopAppSettings> {
    const settings = normalizeAppSettings(value)
    await mkdir(path.dirname(this.settingsPath), { recursive: true })
    const temporary = `${this.settingsPath}.tmp`
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    await rename(temporary, this.settingsPath)
    return settings
  }
}
