import React, { useEffect, useState } from 'react'

interface Project { projectId: string; name: string; path: string; health: string; protocolVersion: string }

// Retry helper — Runtime may still be starting
async function call(fn: () => Promise<any>, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fn()
      if (r && !r.error) return r
      if (r?.error === 'Runtime not started') { await new Promise(r => setTimeout(r, 1000)); continue }
      return r
    } catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  return null
}

export function ProjectsPage(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState('loading')
  const [err, setErr] = useState('')

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setStatus('loading'); setErr('')
    const result = await call(() => window.harness!.listProjects())
    if (Array.isArray(result) && result.length > 0) {
      setProjects(result); setStatus('ok'); return
    }
    // Try auto-import
    const r2 = await call(() => window.harness!.importProject('.'))
    if (r2 && !r2.error) {
      const r3 = await call(() => window.harness!.listProjects())
      if (Array.isArray(r3) && r3.length > 0) { setProjects(r3); setStatus('ok'); return }
    }
    setStatus('empty')
    if (result?.error) setErr(result.error)
    else if (r2?.error) setErr(r2.error)
  }

  async function handleImport() {
    setStatus('loading'); setErr('')
    const r = await call(() => window.harness!.importProject('__dialog__'))
    if (r && !r.error) await loadProjects()
    else { setStatus('ok'); if (r?.error) setErr(r.error) }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Projects</h2>
        <button onClick={handleImport} style={{ padding: '8px 16px', cursor: 'pointer', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6 }}>
          + Import Project
        </button>
      </div>
      {err && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{err}</p>}
      {status === 'loading' && <p>Loading...</p>}
      {status === 'empty' && <p>No projects. Click "+ Import Project" to select a .harness project folder.</p>}
      {status === 'ok' && (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: 8 }}>Name</th><th style={{ padding: 8 }}>Path</th>
            <th style={{ padding: 8 }}>Health</th><th style={{ padding: 8 }}>Protocol</th>
          </tr></thead>
          <tbody>{projects.map(p => (
            <tr key={p.projectId} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, fontWeight: 500 }}>{p.name}</td>
              <td style={{ padding: 8, fontSize: 12, color: '#666' }}>{p.path}</td>
              <td style={{ padding: 8 }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: p.health === 'healthy' ? '#d4edda' : '#fff3cd', color: p.health === 'healthy' ? '#155724' : '#856404' }}>{p.health}</span></td>
              <td style={{ padding: 8 }}>v{p.protocolVersion}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
