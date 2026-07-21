import React, { useState } from 'react'

export function RecoveryPage(): React.ReactElement {
  const [sessions, setSessions] = useState<any[]>([])
  const [cleaned, setCleaned] = useState<string[]>([])
  const [msg, setMsg] = useState('')

  async function scan() {
    setMsg('Scanning...')
    try {
      const result = await window.harness!.scanRecovery('local')
      if (Array.isArray(result)) setSessions(result)
      setMsg(`Found ${result?.length || 0} session(s)`)
    } catch { setMsg('Scan failed') }
  }

  async function cleanup() {
    setMsg('Cleaning...')
    try {
      const result = await window.harness!.cleanupRecovery('local')
      if (Array.isArray(result)) setCleaned(result)
      setMsg(`Cleaned ${result?.length || 0} temp file(s)`)
    } catch { setMsg('Cleanup failed') }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Recovery</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={scan} style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Scan Sessions</button>
        <button onClick={cleanup} style={{ padding: '8px 16px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cleanup Temp Files</button>
      </div>
      {msg && <p style={{ margin: '8px 0', color: '#666' }}>{msg}</p>}

      {sessions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Sessions ({sessions.length})</h3>
          {sessions.map((s: any, i: number) => (
            <div key={i} style={{ padding: '8px 12px', margin: '4px 0', background: s.status === 'recoverable' ? '#d4edda' : s.status === 'orphan' ? '#fff3cd' : '#f8d7da', borderRadius: 4 }}>
              <strong>{s.session_id}</strong> — {s.status}
              {s.pid && <span style={{ marginLeft: 8, fontSize: 12 }}>PID: {s.pid}</span>}
              {s.message && <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>{s.message}</p>}
            </div>
          ))}
        </div>
      )}

      {cleaned.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Cleaned Files</h3>
          {cleaned.map((f, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'monospace' }}>{f}</div>)}
        </div>
      )}
    </div>
  )
}
