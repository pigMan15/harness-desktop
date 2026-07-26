import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, Download, ExternalLink, FolderOpen, Languages, RefreshCw, RotateCcw, ShieldCheck, SlidersHorizontal, TerminalSquare, Trash2, Upload } from 'lucide-react'
import type { CodexSettings } from '../../app/harness-api'
import { useWorkspace } from '../layout/WorkspaceContext'
import { authorizePolicy, loadLocalSettings, policyBlockedMessage, SETTINGS_STORAGE_KEY, type AiProvider, type LocalSettings, type PolicyLevel, type ProfileId } from './settings-policy'
import { useLanguage } from './LanguageContext'
type DiagnosticState = 'idle' | 'running' | 'ok' | 'warn' | 'error'

interface DiagnosticItem {
  id: string
  label: string
  state: DiagnosticState
  detail: string
}

const PROFILES: Array<{ id: ProfileId; title: string; summary: string; policy: Partial<LocalSettings['policy']> }> = [
  { id: 'fast-dev', title: 'Fast development', summary: 'Fewer confirmations for local solo iteration.', policy: { commandExecution: 'ask', gitCommit: 'ask', gitPush: 'block', dirtyWorktree: 'ask' } },
  { id: 'strict-harness', title: 'Strict Harness', summary: 'Keep nodes, gates, records, and Git operations explicit.', policy: { commandExecution: 'ask', gitCommit: 'ask', gitPush: 'ask', dirtyWorktree: 'block' } },
  { id: 'knowledge', title: 'Knowledge promotion', summary: 'Conservative knowledge repo handling with repeat push allowed.', policy: { commandExecution: 'ask', gitCommit: 'ask', gitPush: 'ask', dirtyWorktree: 'block', repeatKnowledgePush: true } },
  { id: 'release', title: 'Release mode', summary: 'Stronger confirmation before package, tag, and release upload.', policy: { commandExecution: 'ask', gitCommit: 'ask', gitPush: 'ask', dirtyWorktree: 'block' } },
]

function providerStatus(settings?: CodexSettings): 'ready' | 'missing' | 'unknown' {
  if (!settings) return 'unknown'
  return settings.lastProbeStatus === 'available' && settings.executablePath ? 'ready' : 'missing'
}

function diagnosticClass(state: DiagnosticState): string {
  if (state === 'ok') return 'success'
  if (state === 'warn') return 'warning'
  if (state === 'error') return 'danger'
  return ''
}

export function CodexSettingsPage(): React.ReactElement {
  const { setLanguage, t } = useLanguage()
  const { selectedProjectId } = useWorkspace()
  const [codexSettings, setCodexSettings] = useState<CodexSettings>()
  const [claudeSettings, setClaudeSettings] = useState<CodexSettings>()
  const [local, setLocal] = useState<LocalSettings>(() => loadLocalSettings())
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [customProfileName, setCustomProfileName] = useState('')
  const [releaseTag, setReleaseTag] = useState('v0.2.1')
  const [releaseTitle, setReleaseTitle] = useState('Harness Desktop 0.2.1')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [releaseAssets, setReleaseAssets] = useState<string[]>([])
  const [releaseProbe, setReleaseProbe] = useState<Record<string, unknown>>()
  const [releaseUrl, setReleaseUrl] = useState('')

  const availableProfiles = useMemo(() => [...PROFILES, ...local.customProfiles], [local.customProfiles])
  const activeProfile = useMemo(() => availableProfiles.find((profile) => profile.id === local.profile) || PROFILES[1], [availableProfiles, local.profile])
  const codexStatus = providerStatus(codexSettings)
  const claudeStatus = providerStatus(claudeSettings)

  const saveLocal = useCallback((next: LocalSettings) => {
    setLocal(next)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
    void window.harness?.setAppSettings(next)
  }, [])

  useEffect(() => {
    void window.harness?.getAppSettings().then((remote) => {
      if (remote && !('error' in remote)) {
        const next = remote as unknown as LocalSettings
        setLocal(next)
        setLanguage(next.language)
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
      } else {
        void window.harness?.setAppSettings(local)
      }
    }).catch(() => {})
  }, [setLanguage])

  const load = useCallback(async () => {
    const codex = await window.harness?.getCodexSettings()
    if (codex && !('error' in codex)) {
      setCodexSettings(codex)
      setLocal((current) => {
        if (current.codexPath === codex.executablePath) return current
        const next = { ...current, codexPath: codex.executablePath }
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
        return next
      })
    }
    const claude = await window.harness?.getAiCliSettings('claude')
    if (claude && !('error' in claude)) {
      setClaudeSettings(claude)
      setLocal((current) => {
        if (current.claudePath === claude.executablePath) return current
        const next = { ...current, claudePath: claude.executablePath }
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
        return next
      })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function probeProvider(provider: AiProvider, select = false): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const result = select ? await window.harness.selectAiCliExecutable(provider) : await window.harness.discoverAiCli(provider)
      if (result.error || result.available !== true) throw new Error(String(result.error || result.diagnostics || `${provider} unavailable`))
      setMessage(`${provider === 'claude' ? 'Claude Code' : 'Codex'} ${String(result.version)} is available.`)
      await load()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : `${provider} probe failed`)
    } finally {
      setBusy(false)
    }
  }

  async function saveProviderPath(provider: AiProvider): Promise<void> {
    if (!window.harness) return
    const executablePath = (provider === 'codex' ? local.codexPath : local.claudePath).trim()
    if (!executablePath) { setMessage(`${provider === 'claude' ? 'Claude Code' : 'Codex'} executable path is required.`); return }
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.setAiCliExecutable(provider, executablePath)
      if (result.error || result.available !== true) throw new Error(String(result.error || result.diagnostics || `${provider} unavailable`))
      setMessage(`${provider === 'claude' ? 'Claude Code' : 'Codex'} is available. Path saved and verified.`)
      await load()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : `${provider} path verification failed`)
    } finally {
      setBusy(false)
    }
  }

  async function runDiagnostics(): Promise<void> {
    if (!window.harness) return
    setBusy(true)
    const next: DiagnosticItem[] = [
      { id: 'runtime', label: 'Runtime', state: 'running', detail: 'Checking runtime health...' },
      { id: 'codex', label: 'Codex CLI', state: 'running', detail: 'Checking Codex discovery...' },
      { id: 'claude', label: 'Claude Code CLI', state: 'running', detail: 'Checking Claude Code discovery...' },
    ]
    setDiagnostics(next)
    try {
      const [runtime, codex, claude] = await Promise.all([
        window.harness.health(),
        window.harness.discoverAiCli('codex'),
        window.harness.discoverAiCli('claude'),
      ])
      setDiagnostics([
        { id: 'runtime', label: 'Runtime', state: runtime.status === 'healthy' ? 'ok' : 'warn', detail: String(runtime.status || runtime.error || 'unknown') },
        { id: 'codex', label: 'Codex CLI', state: codex.available === true ? 'ok' : 'error', detail: String(codex.version || codex.diagnostics || codex.error || 'unavailable') },
        { id: 'claude', label: 'Claude Code CLI', state: claude.available === true ? 'ok' : 'warn', detail: String(claude.version || claude.diagnostics || claude.error || 'not configured') },
      ])
      await load()
    } finally {
      setBusy(false)
    }
  }

  function applyProfile(profileId: ProfileId): void {
    const profile = availableProfiles.find((item) => item.id === profileId)
    if (!profile) return
    saveLocal({ ...local, profile: profileId, policy: { ...local.policy, ...profile.policy } })
  }

  function saveCustomProfile(): void {
    const title = customProfileName.trim()
    if (!title) { setMessage('Custom profile name is required.'); return }
    const id = `custom-${Date.now()}`
    const profile = { id, title, summary: 'Saved from the current Policy Engine settings.', policy: { ...local.policy } }
    saveLocal({ ...local, profile: id, customProfiles: [...local.customProfiles, profile] })
    setCustomProfileName('')
    setMessage('Custom profile is available. Current policy saved.')
  }

  function deleteCustomProfile(profileId: string): void {
    const nextProfiles = local.customProfiles.filter((profile) => profile.id !== profileId)
    saveLocal({ ...local, profile: local.profile === profileId ? 'strict-harness' : local.profile, customProfiles: nextProfiles })
  }

  async function importSettings(): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.importAppSettings()
      if (result.error) throw new Error(String(result.error))
      const next = result.settings as unknown as LocalSettings
      setLocal(next)
      setLanguage(next.language)
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
      setMessage('Settings are available. Import completed.')
    } catch (cause) { if (String(cause).includes('cancelled')) return; setMessage(cause instanceof Error ? cause.message : 'Settings import failed') }
    finally { setBusy(false) }
  }

  async function exportSettings(): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      await window.harness.setAppSettings(local)
      const result = await window.harness.exportAppSettings()
      if (result.error) throw new Error(String(result.error))
      setMessage(`Settings are available in ${String(result.filePath || 'the selected file')}.`)
    } catch (cause) { if (String(cause).includes('cancelled')) return; setMessage(cause instanceof Error ? cause.message : 'Settings export failed') }
    finally { setBusy(false) }
  }

  async function resetSettings(): Promise<void> {
    if (!window.harness || !window.confirm('Restore all application settings to their defaults?')) return
    const result = await window.harness.resetAppSettings()
    if (result.error) { setMessage(String(result.error)); return }
    const next = result as unknown as LocalSettings
    setLocal(next)
    setLanguage(next.language)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next, null, 2))
    setMessage('Default settings are available.')
  }

  async function probeRelease(): Promise<void> {
    if (!window.harness || !selectedProjectId || !releaseTag.trim()) { setMessage('Select a project and enter a release tag.'); return }
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.probeGithubRelease(selectedProjectId, releaseTag.trim())
      if (result.error) throw new Error(String(result.error))
      setReleaseProbe(result)
      setReleaseUrl(typeof (result.release as Record<string, unknown> | undefined)?.url === 'string' ? String((result.release as Record<string, unknown>).url) : '')
      setMessage(result.available === true && result.authenticated === true ? 'GitHub CLI is available and authenticated.' : String(result.diagnostics || 'GitHub CLI is unavailable.'))
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Release probe failed') }
    finally { setBusy(false) }
  }

  async function chooseReleaseAssets(): Promise<void> {
    const result = await window.harness?.selectGithubReleaseAssets()
    if (!result || result.error) return
    setReleaseAssets(Array.isArray(result.assets) ? result.assets.map(String) : [])
  }

  async function publishRelease(): Promise<void> {
    if (!window.harness || !selectedProjectId) { setMessage('Select a project before publishing a release.'); return }
    const authorization = authorizePolicy(local.policy.gitPush, `Publish GitHub Release ${releaseTag.trim()} with ${releaseAssets.length} asset(s)?`)
    if (!authorization.allowed) {
      if (authorization.blocked) setMessage(policyBlockedMessage('GitHub Release publish'))
      return
    }
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.publishGithubRelease(selectedProjectId, {
        tag: releaseTag.trim(), title: releaseTitle.trim(), notes: releaseNotes, assets: releaseAssets,
        draft: local.releaseDraft, overwriteAssets: local.overwriteReleaseAssets,
      }, local.policy.gitPush === 'ask')
      if (result.error) throw new Error(String(result.error))
      setReleaseUrl(String(result.url || ''))
      await probeRelease()
      setMessage(`GitHub Release ${String(result.tag || releaseTag)} is available.`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Release publish failed') }
    finally { setBusy(false) }
  }

  return <section className="page settings-page">
    <header className="page-header">
      <div>
        <h1>{t('settings.title')}</h1>
        <span className="muted">{t('settings.description')}</span>
      </div>
      <div className="actions">
        <button className="button" disabled={busy} onClick={() => void importSettings()}><Upload size={15} />{t('settings.import')}</button>
        <button className="button" disabled={busy} onClick={() => void exportSettings()}><Download size={15} />{t('settings.export')}</button>
        <button className="button" disabled={busy} onClick={() => void resetSettings()}><RotateCcw size={15} />{t('settings.reset')}</button>
      </div>
    </header>
    {message && <div className={message.includes('available') ? 'notice success' : 'notice error'}>{message}</div>}

    <div className="settings-grid">
      <section className="settings-card settings-card-wide">
        <div className="settings-card-title">
          <Languages size={17} />
          <div><h2>{t('settings.language.title')}</h2><p>{t('settings.language.description')}</p></div>
        </div>
        <div className="settings-fields">
          <label>{t('settings.language.label')}<select value={local.language} onChange={(event) => {
            const language = event.target.value as LocalSettings['language']
            setLanguage(language)
            saveLocal({ ...local, language })
          }}><option value="zh-CN">{t('settings.language.zh')}</option><option value="en-US">{t('settings.language.en')}</option></select></label>
        </div>
      </section>

      <section className="settings-card settings-card-wide">
        <div className="settings-card-title">
          <TerminalSquare size={17} />
          <div><h2>{t('settings.providers.title')}</h2><p>{t('settings.providers.description')}</p></div>
        </div>
        <div className="provider-grid">
          <article className={`provider-card ${local.defaultProvider === 'codex' ? 'selected' : ''}`}>
            <div><strong>Codex</strong><span className={`badge ${codexStatus === 'ready' ? 'success' : codexStatus === 'missing' ? 'danger' : ''}`}>{codexStatus}</span></div>
            <input value={local.codexPath} onChange={(event) => saveLocal({ ...local, codexPath: event.target.value })} placeholder="codex executable path, e.g. codex.exe" />
            <small>{codexSettings?.version || '-'} - {codexSettings?.source || 'unknown'}</small>
            <div className="actions">
              <button className="button" disabled={busy} onClick={() => void probeProvider('codex')}><RefreshCw size={15} />{t('settings.discover')}</button>
              <button className="button primary" disabled={busy} onClick={() => void probeProvider('codex', true)}><FolderOpen size={15} />{t('settings.choose')}</button>
              <button className="button" disabled={busy || !local.codexPath.trim()} onClick={() => void saveProviderPath('codex')}>{t('settings.savePath')}</button>
              <button className="button" onClick={() => saveLocal({ ...local, defaultProvider: 'codex' })}>{t('settings.default')}</button>
            </div>
          </article>
          <article className={`provider-card ${local.defaultProvider === 'claude' ? 'selected' : ''}`}>
            <div><strong>Claude Code</strong><span className={`badge ${claudeStatus === 'ready' ? 'success' : 'warning'}`}>{claudeStatus}</span></div>
            <input value={local.claudePath} onChange={(event) => saveLocal({ ...local, claudePath: event.target.value })} placeholder="claude executable path, e.g. claude.exe" />
            <small>{claudeSettings?.executablePath || 'Select or discover Claude Code to enable terminal launch.'}</small>
            <div className="actions">
              <button className="button" disabled={busy} onClick={() => void probeProvider('claude')}><RefreshCw size={15} />{t('settings.discover')}</button>
              <button className="button primary" disabled={busy} onClick={() => void probeProvider('claude', true)}><FolderOpen size={15} />{t('settings.choose')}</button>
              <button className="button" disabled={busy || !local.claudePath.trim()} onClick={() => void saveProviderPath('claude')}>{t('settings.savePath')}</button>
              <button className="button" onClick={() => saveLocal({ ...local, defaultProvider: 'claude' })}>{t('settings.default')}</button>
            </div>
          </article>
        </div>
      </section>

      <section className="settings-card settings-card-wide">
        <div className="settings-card-title">
          <SlidersHorizontal size={17} />
          <div><h2>{t('settings.profiles.title')}</h2><p>{activeProfile.summary}</p></div>
        </div>
        <div className="profile-list">
          {availableProfiles.map((profile) => <div key={profile.id} className={`profile-list-item ${local.profile === profile.id ? 'active' : ''}`}>
            <button onClick={() => applyProfile(profile.id)}><strong>{profile.title}</strong><span>{profile.summary}</span></button>
            {profile.id.startsWith('custom-') && <button className="button icon-button" title={t('settings.deleteProfile')} onClick={() => deleteCustomProfile(profile.id)}><Trash2 size={14} /></button>}
          </div>)}
        </div>
        <div className="settings-inline-create"><input value={customProfileName} onChange={(event) => setCustomProfileName(event.target.value)} placeholder={t('settings.profileName')} /><button className="button" onClick={saveCustomProfile}>{t('settings.saveCurrent')}</button></div>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <ShieldCheck size={17} />
          <div><h2>{t('settings.policy.title')}</h2><p>{t('settings.policy.description')}</p></div>
        </div>
        <div className="settings-fields">
          <label>{t('settings.commandExecution')}<select value={local.policy.commandExecution} onChange={(event) => saveLocal({ ...local, policy: { ...local.policy, commandExecution: event.target.value as PolicyLevel } })}><option value="ask">{t('settings.ask')}</option><option value="allow">{t('settings.allow')}</option><option value="block">{t('settings.block')}</option></select></label>
          <label>{t('settings.gitCommit')}<select value={local.policy.gitCommit} onChange={(event) => saveLocal({ ...local, policy: { ...local.policy, gitCommit: event.target.value as PolicyLevel } })}><option value="ask">{t('settings.ask')}</option><option value="allow">{t('settings.allow')}</option><option value="block">{t('settings.block')}</option></select></label>
          <label>{t('settings.gitPush')}<select value={local.policy.gitPush} onChange={(event) => saveLocal({ ...local, policy: { ...local.policy, gitPush: event.target.value as PolicyLevel } })}><option value="ask">{t('settings.ask')}</option><option value="allow">{t('settings.allow')}</option><option value="block">{t('settings.block')}</option></select></label>
          <label>{t('settings.dirtyWorktree')}<select value={local.policy.dirtyWorktree} onChange={(event) => saveLocal({ ...local, policy: { ...local.policy, dirtyWorktree: event.target.value as LocalSettings['policy']['dirtyWorktree'] } })}><option value="block">{t('settings.block')}</option><option value="ask">{t('settings.ask')}</option><option value="allow">{t('settings.allow')}</option></select></label>
          <label className="check-field"><input type="checkbox" checked={local.policy.repeatKnowledgePush} onChange={(event) => saveLocal({ ...local, policy: { ...local.policy, repeatKnowledgePush: event.target.checked } })} />{t('settings.repeatKnowledge')}</label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <CheckCircle2 size={17} />
          <div><h2>{t('settings.release.title')}</h2><p>{t('settings.release.description')}</p></div>
        </div>
        <div className="settings-fields release-settings-fields">
          <label>{t('settings.tagPrefix')}<input value={local.releaseTagPrefix} onChange={(event) => saveLocal({ ...local, releaseTagPrefix: event.target.value })} /></label>
          <label>{t('settings.releaseTag')}<input value={releaseTag} onChange={(event) => setReleaseTag(event.target.value)} placeholder={`${local.releaseTagPrefix}0.3.0`} /></label>
          <label>{t('settings.releaseTitle')}<input value={releaseTitle} onChange={(event) => setReleaseTitle(event.target.value)} /></label>
          <label className="settings-field-wide">{t('settings.releaseNotes')}<textarea value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder={t('settings.releaseNotesPlaceholder')} /></label>
          <label className="check-field"><input type="checkbox" checked={local.releaseDraft} onChange={(event) => saveLocal({ ...local, releaseDraft: event.target.checked })} />{t('settings.draft')}</label>
          <label className="check-field"><input type="checkbox" checked={local.overwriteReleaseAssets} onChange={(event) => saveLocal({ ...local, overwriteReleaseAssets: event.target.checked })} />{t('settings.overwriteAssets')}</label>
        </div>
        <div className="release-assets">
          <div><strong>{t('settings.assets')}</strong><span>{releaseAssets.length === 0 ? t('settings.noAssets') : t('settings.selectedFiles', { count: releaseAssets.length })}</span></div>
          {releaseAssets.map((asset) => <code key={asset} title={asset}>{asset}</code>)}
        </div>
        {releaseProbe && <div className="knowledge-repo-status">
          <span className={`badge ${releaseProbe.available === true ? 'success' : 'danger'}`}>gh {releaseProbe.available === true ? 'ready' : 'missing'}</span>
          <span className={`badge ${releaseProbe.authenticated === true ? 'success' : 'warning'}`}>{releaseProbe.authenticated === true ? 'authenticated' : 'auth required'}</span>
          <span className={`badge ${releaseProbe.releaseExists === true ? 'success' : ''}`}>{releaseProbe.releaseExists === true ? 'release exists' : 'new release'}</span>
          {releaseProbe.dirty === true && <span className="badge warning">dirty worktree</span>}
        </div>}
        <div className="actions release-actions">
          <button className="button" disabled={busy || !selectedProjectId} onClick={() => void probeRelease()}><RefreshCw size={15} />{t('settings.probe')}</button>
          <button className="button" disabled={busy} onClick={() => void chooseReleaseAssets()}><FolderOpen size={15} />{t('settings.chooseAssets')}</button>
          <button className="button primary" disabled={busy || !selectedProjectId || !releaseTag.trim()} onClick={() => void publishRelease()}><Upload size={15} />{t('settings.publishRelease')}</button>
          {releaseUrl && <a className="button" href={releaseUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />{t('settings.openRelease')}</a>}
        </div>
      </section>

      <section className="settings-card settings-card-wide">
        <div className="settings-card-title">
          <Activity size={17} />
          <div><h2>{t('settings.diagnostics.title')}</h2><p>{t('settings.diagnostics.description')}</p></div>
        </div>
        <div className="settings-diagnostics">
          <button className="button primary" disabled={busy} onClick={() => void runDiagnostics()}><RefreshCw size={15} />{t('settings.runDiagnostics')}</button>
          <div className="diagnostic-list">
            {(diagnostics.length > 0 ? diagnostics : [
              { id: 'runtime', label: 'Runtime', state: 'idle', detail: t('settings.notChecked') },
              { id: 'codex', label: 'Codex CLI', state: 'idle', detail: codexSettings?.version || t('settings.notChecked') },
              { id: 'claude', label: 'Claude Code CLI', state: 'idle', detail: claudeSettings?.version || t('settings.notChecked') },
            ] as DiagnosticItem[]).map((item) => <div key={item.id} className="diagnostic-row">
              <span className={`badge ${diagnosticClass(item.state)}`}>{item.state}</span>
              <strong>{item.label}</strong>
              <code>{item.detail}</code>
            </div>)}
          </div>
        </div>
      </section>
    </div>
  </section>
}
