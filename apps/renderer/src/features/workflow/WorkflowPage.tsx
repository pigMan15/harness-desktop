import React, { useState } from 'react'

export function WorkflowPage(): React.ReactElement {
  const [nodes, setNodes] = useState<any[]>([])
  const [stats, setStats] = useState<{ total: number; completed: number } | null>(null)

  async function loadWorkflow() {
    try {
      const result = await window.harness!.getWorkflow('local')
      if (result?.nodes) {
        setNodes(result.nodes)
      }
      if (result?.state) {
        setStats({
          total: result.state.required_nodes?.length || 0,
          completed: result.state.completed_nodes?.length || 0,
        })
      }
    } catch { /* ignore */ }
  }

  React.useEffect(() => { loadWorkflow() }, [])

  return (
    <div style={{ padding: 24 }}>
      <h2>Workflow</h2>
      {stats && (
        <div style={{ margin: '12px 0', padding: 12, background: '#f0f0f0', borderRadius: 8 }}>
          <strong>Progress:</strong> {stats.completed}/{stats.total} nodes
          <div style={{ marginTop: 8, height: 8, background: '#ddd', borderRadius: 4 }}>
            <div style={{
              height: 8, borderRadius: 4, background: '#4caf50',
              width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
            }} />
          </div>
        </div>
      )}
      {nodes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {nodes.map((n: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
              borderBottom: '1px solid #eee', fontSize: 14,
            }}>
              <span style={{ minWidth: 24, color: '#999' }}>{i + 1}</span>
              <span style={{ fontWeight: 500, minWidth: 200 }}>{n.id}</span>
              <span style={{ color: '#666' }}>{n.role}</span>
              <span style={{ fontSize: 12, color: '#999' }}>→ {n.artifact}</span>
            </div>
          ))}
        </div>
      )}
      {nodes.length === 0 && <p style={{ color: '#999' }}>No workflow data. Import a project first.</p>}
    </div>
  )
}
