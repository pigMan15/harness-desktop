import React, { useState } from 'react'

export function RunsPage(): React.ReactElement {
  const [runs, setRuns] = useState<any[]>([])
  const [status, setStatus] = useState('idle')

  async function loadRuns() {
    setStatus('loading')
    try {
      const result = await window.harness!.listRuns('local')
      if (Array.isArray(result)) {
        setRuns(result)
        setStatus('ok')
      } else {
        setStatus('empty')
      }
    } catch { setStatus('error') }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Runs</h2>
        <button onClick={loadRuns} style={{ padding: '8px 16px', cursor: 'pointer' }}>Refresh</button>
      </div>
      {status === 'idle' && <p>Click Refresh to load runs.</p>}
      {status === 'loading' && <p>Loading...</p>}
      {status === 'empty' && <p>No runs found. Import a project first.</p>}
      {status === 'error' && <p style={{ color: 'red' }}>Failed to load runs.</p>}
      {status === 'ok' && (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Run ID</th>
              <th style={{ padding: 8 }}>Intent</th>
              <th style={{ padding: 8 }}>Risk</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}>{r.run_id || r.runId}</td>
                <td style={{ padding: 8 }}>{r.intent}</td>
                <td style={{ padding: 8 }}>{r.risk}</td>
                <td style={{ padding: 8 }}>{r.status}</td>
                <td style={{ padding: 8 }}>{(r.completed_nodes || r.completedNodes || []).length}/{r.required_nodes?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
