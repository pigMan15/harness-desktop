import React, { useState } from 'react'

const INTENTS = ['FEATURE', 'BUG_FIX', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT', 'QUERY']
const RISKS = ['LOW', 'MEDIUM', 'HIGH']

export function RunsPage(): React.ReactElement {
  const [runs, setRuns] = useState<any[]>([])
  const [status, setStatus] = useState('idle')
  const [showCreate, setShowCreate] = useState(false)
  const [newIntent, setNewIntent] = useState('FEATURE')
  const [newRisk, setNewRisk] = useState('MEDIUM')
  const [newRunId, setNewRunId] = useState('')

  async function loadRuns() {
    setStatus('loading')
    try {
      const result = await window.harness!.listRuns('local')
      if (Array.isArray(result)) { setRuns(result); setStatus('ok') }
      else setStatus('empty')
    } catch { setStatus('error') }
  }

  async function handleCreate() {
    if (!newRunId.trim()) return alert('Enter a Run ID')
    try {
      await window.harness!.createRun('local', newIntent, newRisk, newRunId.trim())
      setShowCreate(false); setNewRunId('')
      await loadRuns()
    } catch (e: any) { alert('Failed: ' + (e.message || 'unknown')) }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Runs</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadRuns} style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 6 }}>Refresh</button>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '8px 16px', cursor: 'pointer', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6 }}>
            + New Run
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={{ marginTop: 16, padding: 16, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <h3>Create New Run</h3>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <label>Intent: <select value={newIntent} onChange={e => setNewIntent(e.target.value)} style={{ padding: 6 }}>
              {INTENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select></label>
            <label>Risk: <select value={newRisk} onChange={e => setNewRisk(e.target.value)} style={{ padding: 6 }}>
              {RISKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select></label>
            <input value={newRunId} onChange={e => setNewRunId(e.target.value)} placeholder="run-id (e.g. feat-001)"
              style={{ padding: 6, width: 200 }} />
            <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Create</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {status === 'idle' && <p style={{ marginTop: 16 }}>Click Refresh or create a new run.</p>}
      {status === 'loading' && <p>Loading...</p>}
      {status === 'empty' && <p>No runs found. Import a project first.</p>}
      {status === 'ok' && (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: 8 }}>Run ID</th><th style={{ padding: 8 }}>Intent</th>
            <th style={{ padding: 8 }}>Risk</th><th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Progress</th>
          </tr></thead>
          <tbody>{runs.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.run_id || r.runId}</td>
              <td style={{ padding: 8 }}>{r.intent}</td><td style={{ padding: 8 }}>{r.risk}</td>
              <td style={{ padding: 8 }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12,
                background: r.status === 'DONE' ? '#d4edda' : r.status === 'BLOCKED' ? '#f8d7da' : '#e2e3e5',
                color: r.status === 'DONE' ? '#155724' : r.status === 'BLOCKED' ? '#721c24' : '#383d41'
              }}>{r.status}</span></td>
              <td style={{ padding: 8 }}>{(r.completed_nodes || r.completedNodes || []).length}/{r.required_nodes?.length || 0}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
