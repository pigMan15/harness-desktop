import React, { useCallback, useEffect, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

const GATE_INFO: Record<string, string> = {
  G1_REQUIREMENTS: 'Requirements', G2_DESIGN: 'Design', G3_COMPILE: 'Compile', G4_UNIT_TEST: 'Unit Test',
  G5_ATDD: 'ATDD', G6_EVIDENCE: 'Evidence', G7_PRERELEASE: 'Prerelease', G8_ACCEPTANCE: 'Acceptance',
}

interface GateContext {
  runId: string
  currentNode: string
  nextRole: string
  phaseDir: string
  revision: string
  gates: Record<string, string>
}

function GatesContent(): React.ReactElement {
  const { selectedProjectId, activeRun } = useWorkspace()
  const [context, setContext] = useState<GateContext>()
  const [busyGate, setBusyGate] = useState('')
  const [message, setMessage] = useState('')

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

  return <section className="page">
    <header className="page-header"><h1>Quality Gates</h1><button className="button icon-button" onClick={() => void refresh()} title="Refresh gates">R</button></header>
    {message && <div className={message.includes('PASS') ? 'notice' : 'notice error'}>{message}</div>}
    {!activeRun && <div className="empty-state"><h2>Select a task</h2><p>Create or select a task to inspect its gates.</p></div>}
    {context && <div className="panel toolbar"><span className="badge success">ACTIVE RUN</span><strong className="mono">{context.runId}</strong><span className="muted">Node {context.currentNode}</span><span className="muted">Role {context.nextRole}</span><span className="mono muted">rev {context.revision.slice(0, 10)}</span></div>}
    <div className="panel" style={{ marginTop: 14 }}><table className="data-table"><thead><tr><th>Gate</th><th>Name</th><th>Status</th><th /></tr></thead>
      <tbody>{Object.entries(GATE_INFO).map(([gateId, name]) => {
        const status = context?.gates[gateId] || 'NOT_RUN'
        const style = status === 'PASS' ? 'success' : status === 'FAIL' || status === 'BLOCKED' ? 'danger' : status === 'WAIVED' ? 'warning' : ''
        return <tr key={gateId}><td className="mono">{gateId}</td><td>{name}</td><td><span className={`badge ${style}`}>{status}</span></td><td style={{ textAlign: 'right' }}>
          <button className="button" disabled={!context || Boolean(busyGate) || status === 'NOT_REQUIRED'} onClick={() => void evaluate(gateId)}>Evaluate</button>
        </td></tr>
      })}</tbody></table></div>
  </section>
}

export function GatesPage(): React.ReactElement { return <ProjectRequired><GatesContent /></ProjectRequired> }
