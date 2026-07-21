import React, { useState } from 'react'

export function RecoveryPage(): React.ReactElement {
  const [sessions, setSessions] = useState<any[]>([])
  const [cleaned, setCleaned] = useState<string[]>([])
  const [msg, setMsg] = useState('')

  async function scan() {
    setMsg('Scanning...')
    try {
      const r = await window.harness!.scanRecovery('local')
      if (Array.isArray(r)) { setSessions(r); setMsg(r.length === 0 ? 'No active sessions' : `Found ${r.length} sessions`) }
      else setMsg(r?.error || 'Scan failed')
    } catch (e: any) { setMsg(e.message) }
  }

  async function cleanup() {
    setMsg('Cleaning...')
    try {
      const r = await window.harness!.cleanupRecovery('local')
      if (Array.isArray(r)) { setCleaned(r); setMsg(r.length === 0 ? 'Nothing to clean' : `Cleaned ${r.length} files`) }
      else setMsg(r?.error || 'Cleanup failed')
    } catch (e: any) { setMsg(e.message) }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Recovery</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={scan} style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Scan Sessions</button>
        <button onClick={cleanup} style={{ padding: '8px 16px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cleanup Temp Files</button>
      </div>
      {msg && <p style={{ margin: '8px 0', color: '#666', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>{msg}</p>}

      {sessions.length > 0 && sessions.map((s: any, i: number) => (
        <div key={i} style={{ padding: '8px 12px', margin: '4px 0', borderRadius: 4,
          background: s.status === 'recoverable' ? '#d4edda' : s.status === 'orphan' ? '#fff3cd' : '#f8d7da' }}>
          <strong>{s.session_id}</strong> — {s.status} {s.pid && <span style={{ fontSize: 12 }}>PID:{s.pid}</span>}
        </div>
      ))}

      {cleaned.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Cleaned Files</h3>
          {cleaned.map((f, i) => <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', padding: '2px 0' }}>{f}</div>)}
        </div>
      )}
    </div>
  )
}
