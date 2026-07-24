import React, { useCallback, useEffect, useState } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import type { CodexSettings } from '../../app/harness-api'

export function CodexSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<CodexSettings>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await window.harness?.getCodexSettings()
    if (result && !('error' in result)) setSettings(result)
  }, [])
  useEffect(() => { void load() }, [load])

  async function probe(select: boolean): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const result = select ? await window.harness.selectCodexExecutable() : await window.harness.discoverCodex()
      if (result.error || result.available !== true) throw new Error(String(result.error || result.diagnostics || 'Codex unavailable'))
      setMessage(`Codex ${String(result.version)} is available.`)
      await load()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Codex probe failed') }
    finally { setBusy(false) }
  }

  return <section className="page settings-page">
    <header className="page-header"><h1>Codex Settings</h1></header>
    {message && <div className={message.includes('available') ? 'notice success' : 'notice error'}>{message}</div>}
    <div className="settings-section">
      <div><h2>Executable</h2><p className="muted">Codex CLI used by native run terminals.</p></div>
      <div className="settings-value"><strong className="mono">{settings?.executablePath || 'Not configured'}</strong><span>{settings?.version || '-'}</span><span className="badge">{settings?.source || 'unknown'}</span></div>
      <div className="actions">
        <button className="button" disabled={busy} onClick={() => void probe(false)}><RefreshCw size={15} />Discover</button>
        <button className="button primary" disabled={busy} onClick={() => void probe(true)}><FolderOpen size={15} />Choose executable</button>
      </div>
    </div>
  </section>
}
