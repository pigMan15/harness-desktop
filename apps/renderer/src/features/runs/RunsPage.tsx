import React, { useCallback, useEffect, useState } from 'react'
import type { RunSummary } from '../../app/harness-api'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

const INTENTS = ['QUERY', 'BUG_FIX', 'FEATURE', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

function runFromState(state: Record<string, unknown>): RunSummary {
  return {
    run_id: String(state.run_id || ''), intent: String(state.intent || ''), risk: String(state.risk || ''),
    status: String(state.status || ''), current_node: String(state.current_node || ''), next_role: String(state.next_role || ''),
    completed_nodes: (state.completed_nodes as string[]) || [], required_nodes: (state.required_nodes as string[]) || [],
    blocked_by: (state.blocked_by as string[]) || [], phase_dir: String(state.phase_dir || ''), active: true,
    revision: String(state.revision || ''), branch_name: state.branch_name ? String(state.branch_name) : undefined,
    worktree_path: state.worktree_path ? String(state.worktree_path) : undefined,
  }
}

function TasksContent(): React.ReactElement {
  const { selectedProjectId, revision, updateActiveRun } = useWorkspace()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [intent, setIntent] = useState('FEATURE')
  const [risk, setRisk] = useState('MEDIUM')
  const [runId, setRunId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const loadRuns = useCallback(async () => {
    if (!window.harness || !selectedProjectId) return
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.listRuns(selectedProjectId)
      if (!Array.isArray(result)) throw new Error(result.error)
      setRuns(result)
      const selected = result.find((run) => run.active)
      updateActiveRun(selected, selected?.revision)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Failed to load tasks') }
    finally { setBusy(false) }
  }, [selectedProjectId, updateActiveRun])

  useEffect(() => { void loadRuns() }, [loadRuns])

  async function createRun(): Promise<void> {
    if (!window.harness || !runId.trim()) { setMessage('Run ID is required.'); return }
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.createRun(selectedProjectId, intent, risk, runId.trim(), revision || undefined)
      if (result.error) throw new Error(String(result.error))
      updateActiveRun(runFromState(result.run as Record<string, unknown>), String(result.revision || ''))
      setRunId(''); setShowCreate(false); await loadRuns()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Create failed') }
    finally { setBusy(false) }
  }

  async function runAction(action: 'switch' | 'pause' | 'resume', run: RunSummary): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const fn = action === 'switch' ? window.harness.switchRun : action === 'pause' ? window.harness.pauseRun : window.harness.resumeRun
      const result = await fn(selectedProjectId, run.run_id, run.revision || undefined)
      if (result.error) throw new Error(String(result.error))
      updateActiveRun(runFromState(result.run as Record<string, unknown>), String(result.revision || ''))
      await loadRuns()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : `${action} failed`) }
    finally { setBusy(false) }
  }

  return (
    <section className="page">
      <header className="page-header"><h1>Tasks</h1><div className="actions">
        <button className="button icon-button" onClick={() => void loadRuns()} title="Refresh tasks" aria-label="Refresh tasks">R</button>
        <button className="button primary" onClick={() => setShowCreate((value) => !value)}>+ New task</button>
      </div></header>
      {message && <div className="notice error">{message}</div>}
      {showCreate && <div className="panel form-row">
        <label className="field">Run ID<input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="feature-20260723" /></label>
        <label className="field">Intent<select value={intent} onChange={(event) => setIntent(event.target.value)}>{INTENTS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field">Risk<select value={risk} onChange={(event) => setRisk(event.target.value)}>{RISKS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className="button primary" disabled={busy} onClick={() => void createRun()}>Create</button>
        <button className="button" onClick={() => setShowCreate(false)}>Cancel</button>
      </div>}
      <div className="panel" style={{ marginTop: 14 }}>
        {runs.length === 0 && !busy ? <div className="empty-state"><h2>No tasks</h2><p>Create a task from the project workflow.</p></div> :
          <table className="data-table"><thead><tr><th>Run ID</th><th>Intent / Risk</th><th>Status</th><th>Current node</th><th>Progress</th><th /></tr></thead>
          <tbody>{runs.map((run) => <tr key={run.run_id} className={run.active ? 'selected' : ''}>
            <td className="mono"><strong>{run.run_id}</strong>{run.active && <span className="badge success" style={{ marginLeft: 8 }}>ACTIVE</span>}</td>
            <td>{run.intent} <span className="muted">/ {run.risk}</span></td>
            <td><span className={`badge ${run.status === 'BLOCKED' ? 'danger' : run.status === 'DONE' ? 'success' : ''}`}>{run.status}</span></td>
            <td>{run.current_node}</td><td>{run.completed_nodes.length}/{run.required_nodes.length}</td>
            <td><div className="actions" style={{ justifyContent: 'flex-end' }}>
              {!run.active && <button className="button icon-button" title="Switch to task" onClick={() => void runAction('switch', run)}>S</button>}
              {run.active && run.blocked_by.includes('user_paused') && <button className="button icon-button" title="Resume task" onClick={() => void runAction('resume', run)}>&gt;</button>}
              {run.active && !run.blocked_by.includes('user_paused') && <button className="button icon-button" title="Pause task" onClick={() => void runAction('pause', run)}>||</button>}
            </div></td>
          </tr>)}</tbody></table>}
      </div>
    </section>
  )
}

export function RunsPage(): React.ReactElement { return <ProjectRequired><TasksContent /></ProjectRequired> }
