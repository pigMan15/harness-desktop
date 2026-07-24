import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

interface GateContext {
  runId: string
  currentNode: string
  nextRole: string
  phaseDir: string
  revision: string
  gates: Record<string, string>
  definitions: Record<string, { meaning?: string; description?: string; required_artifacts?: string[] }>
  waivers: Record<string, { scope: string; reason: string; owner: string; time: string }>
}

function GatesContent(): React.ReactElement {
  const { selectedProjectId, activeRun } = useWorkspace()
  const [context, setContext] = useState<GateContext>()
  const [busyGate, setBusyGate] = useState('')
  const [message, setMessage] = useState('')
  const [waiveGateId, setWaiveGateId] = useState('')
  const [waiver, setWaiver] = useState({ scope: '', reason: '', owner: '' })

  const refresh = useCallback(async () => {
    if (!window.harness || !activeRun) { setContext(undefined); return }
    setMessage('')
    try {
      const result = await window.harness.listGates(selectedProjectId, activeRun.run_id)
      if (result.error) throw new Error(String(result.error))
      setContext(result as unknown as GateContext)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gate load failed') }
  }, [selectedProjectId, activeRun])

  useEffect(() => { void refresh() }, [refresh])

  async function evaluate(gateId: string): Promise<void> {
    if (!window.harness || !context) return
    setBusyGate(gateId); setMessage('')
    try {
      const result = await window.harness.evaluateGate(selectedProjectId, context.runId, gateId, context.revision)
      if (result.error) throw new Error(String(result.error))
      setMessage(`${gateId}: ${String(result.status)} - ${String(result.reason)}`)
      await refresh()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gate evaluation failed') }
    finally { setBusyGate('') }
  }

  async function waive(): Promise<void> {
    if (!window.harness || !context || !waiveGateId) return
    setBusyGate(waiveGateId); setMessage('')
    try {
      const result = await window.harness.waiveGate(selectedProjectId, context.runId, waiveGateId, waiver.scope, waiver.reason, waiver.owner, context.revision)
      if (result.error) throw new Error(String(result.error))
      setWaiveGateId(''); setWaiver({ scope: '', reason: '', owner: '' }); await refresh()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gate waiver failed') }
    finally { setBusyGate('') }
  }

  return <section className="page">
    <header className="page-header"><h1>Quality Gates</h1><button className="button icon-button" onClick={() => void refresh()} title="Refresh gates"><RefreshCw size={15} /></button></header>
    {message && <div className={message.includes('PASS') ? 'notice' : 'notice error'}>{message}</div>}
    {!activeRun && <div className="empty-state"><h2>Select a task</h2><p>Create or select a task to inspect its gates.</p></div>}
    {context && <div className="panel toolbar"><span className="badge success">ACTIVE RUN</span><strong className="mono">{context.runId}</strong><span className="muted">Node {context.currentNode}</span><span className="muted">Role {context.nextRole}</span><span className="mono muted">rev {context.revision.slice(0, 10)}</span></div>}
    {waiveGateId && <div className="panel form-row"><label className="field">Scope<input value={waiver.scope} onChange={(event) => setWaiver((value) => ({ ...value, scope: event.target.value }))} /></label><label className="field">Reason<input value={waiver.reason} onChange={(event) => setWaiver((value) => ({ ...value, reason: event.target.value }))} /></label><label className="field">Owner<input value={waiver.owner} onChange={(event) => setWaiver((value) => ({ ...value, owner: event.target.value }))} /></label><button className="button danger" disabled={!waiver.scope || !waiver.reason || !waiver.owner} onClick={() => void waive()}>Record waiver</button><button className="button" onClick={() => setWaiveGateId('')}>Cancel</button></div>}
    <div className="panel" style={{ marginTop: 14 }}><table className="data-table"><thead><tr><th>Gate</th><th>Meaning / Required artifacts</th><th>Status</th><th /></tr></thead>
      <tbody>{Object.entries(context?.definitions || {}).map(([gateId, definition]) => {
        const status = context?.gates[gateId] || 'NOT_RUN'
        const style = status === 'PASS' ? 'success' : status === 'FAIL' || status === 'BLOCKED' ? 'danger' : status === 'WAIVED' ? 'warning' : ''
        const existingWaiver = context?.waivers?.[gateId]
        return <tr key={gateId}><td className="mono">{gateId}</td><td><div>{definition.meaning || definition.description || gateId}</div><span className="muted mono">{definition.required_artifacts?.join(', ') || 'No required artifacts'}</span>{existingWaiver && <div className="muted">Waived by {existingWaiver.owner}: {existingWaiver.reason}</div>}</td><td><span className={`badge ${style}`}>{status}</span></td><td style={{ textAlign: 'right' }}><div className="actions">
          <button className="button" disabled={!context || Boolean(busyGate) || status === 'NOT_REQUIRED'} onClick={() => void evaluate(gateId)}>Evaluate</button>
          <button className="button" disabled={!context || Boolean(busyGate)} onClick={() => setWaiveGateId(gateId)}>Waive</button>
        </div></td></tr>
      })}</tbody></table></div>
  </section>
}

export function GatesPage(): React.ReactElement { return <ProjectRequired><GatesContent /></ProjectRequired> }
