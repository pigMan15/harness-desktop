import React, { useEffect, useState } from 'react'

interface Project {
  projectId: string; name: string; path: string; health: string; protocolVersion: string
}

export function ProjectsPage(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setStatus('loading')
    try {
      const result = await window.harness!.listProjects()
      if (Array.isArray(result)) {
        setProjects(result)
        setStatus('ok')
      } else {
        setStatus('empty')
      }
    } catch {
      setStatus('error')
    }
  }

  async function handleImport() {
    setStatus('loading')
    try {
      await window.harness!.importProject('')
      await loadProjects()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Projects</h2>
        <button onClick={handleImport} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          + Import Project
        </button>
      </div>
      {status === 'loading' && <p>Loading...</p>}
      {status === 'empty' && <p>No projects. Click "+ Import Project" to add a .harness project.</p>}
      {status === 'error' && <p style={{ color: 'red' }}>Runtime unavailable — start Runtime first</p>}
      {status === 'ok' && (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Path</th>
              <th style={{ padding: 8 }}>Health</th>
              <th style={{ padding: 8 }}>Protocol</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.projectId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8, fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: 8, fontSize: 12, color: '#666' }}>{p.path}</td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: p.health === 'healthy' ? '#d4edda' : '#fff3cd',
                    color: p.health === 'healthy' ? '#155724' : '#856404',
                  }}>{p.health}</span>
                </td>
                <td style={{ padding: 8 }}>v{p.protocolVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
