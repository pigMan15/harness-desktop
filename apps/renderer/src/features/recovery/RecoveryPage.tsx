import React, { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

interface RecoverySession {
  session_id: string
  session_type?: string
  status: string
  pid?: number
  run_id?: string
  node_id?: string
  branch_name?: string
  worktree_path?: string
  thread_id?: string
  turn_id?: string
  message?: string
}

function RecoveryContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<RecoverySession[]>([])
  const [cleaned, setCleaned] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown>>()

  const scan = useCallback(async (): Promise<void> => {
    setMessage('Scanning...')
    try {
      const result = await window.harness!.scanRecovery(selectedProjectId)
      if (!Array.isArray(result)) throw new Error(result.error || 'Scan failed')
      setSessions(result as RecoverySession[])
      setMessage(result.length === 0 ? 'No active sessions' : `Found ${result.length} sessions`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Scan failed') }
  }, [selectedProjectId])

  useEffect(() => { void scan() }, [scan])

  async function cleanup(): Promise<void> {
    setMessage('Cleaning...')
    try {
      const result = await window.harness!.cleanupRecovery(selectedProjectId)
      if (!Array.isArray(result)) throw new Error(result.error || 'Cleanup failed')
      setCleaned(result)
      setMessage(result.length === 0 ? 'Nothing to clean' : `Cleaned ${result.length} files`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Cleanup failed') }
  }

  async function stopTerminal(sessionId: string): Promise<void> {
    setMessage('Stopping terminal session...')
    try {
      await window.harness!.stopTerminal(sessionId)
      setMessage('Terminal session stopped')
      await scan()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Stop terminal failed') }
  }

  return <section className="page">
    <header className="page-header"><h1>Recovery</h1><div className="actions">
      <button className="button" onClick={() => void scan()}>Refresh sessions</button>
      <button className="button" onClick={() => void cleanup()}>Cleanup temp files</button>
      <button className="button" onClick={() => void window.harness?.exportDiagnostics(selectedProjectId).then((result) => { setDiagnostics(result); setMessage('Redacted diagnostics generated') })}><Download size={15} />Diagnostics</button>
    </div></header>
    {message && <div className="notice">{message}</div>}
    <div className="panel" style={{ marginTop: 14 }}>
      {sessions.length === 0 ? <div className="empty-state"><h2>No sessions</h2></div> : sessions.map((session) => (
        <div key={session.session_id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="toolbar"><strong className="mono">{session.session_id}</strong><span className="badge">{session.session_type || 'executor'}</span><span className="badge">{session.status}</span>{session.pid && <span className="mono muted">PID {session.pid}</span>}<span style={{ flex: 1 }} />
            {session.session_type?.startsWith('terminal:') && <button className="button" onClick={() => navigate('/terminal')}>Open Terminal</button>}
            {session.session_type?.startsWith('terminal:') && session.status === 'recoverable' && <button className="button danger" onClick={() => void stopTerminal(session.session_id)}>Stop</button>}
          </div>
          <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>Run: {session.run_id || '-'} / Node: {session.node_id || '-'}</div>
          {session.branch_name && <div className="mono" style={{ fontSize: 12 }}>Branch: {session.branch_name}</div>}
          {session.worktree_path && <div className="mono muted" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>Worktree: {session.worktree_path}</div>}
          {(session.thread_id || session.turn_id) && <div className="mono muted" style={{ fontSize: 12 }}>Thread: {session.thread_id || '-'} / Turn: {session.turn_id || '-'}</div>}
          {session.message && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{session.message}</div>}
        </div>
      ))}
    </div>
    {cleaned.length > 0 && <div className="panel" style={{ marginTop: 14, padding: 12 }}>{cleaned.map((file) => <div key={file} className="mono" style={{ fontSize: 12 }}>{file}</div>)}</div>}
    {diagnostics && <details className="semantic-diff" open><summary>Redacted diagnostics</summary><pre>{JSON.stringify(diagnostics, null, 2)}</pre></details>}
  </section>
}

export function RecoveryPage(): React.ReactElement { return <ProjectRequired><RecoveryContent /></ProjectRequired> }
