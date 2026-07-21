import React, { useState } from 'react'

const INTENTS = ['FEATURE', 'BUG_FIX', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT', 'QUERY']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

export function WorkflowPage(): React.ReactElement {
  const [nodes, setNodes] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [compileResult, setCompileResult] = useState<any>(null)
  const [intent, setIntent] = useState('FEATURE')
  const [risk, setRisk] = useState('HIGH')

  async function loadWorkflow() {
    try {
      const result = await window.harness!.getWorkflow('local')
      if (result?.nodes) setNodes(result.nodes)
      if (result?.state) {
        setStats({ total: result.state.required_nodes?.length || 0, completed: result.state.completed_nodes?.length || 0,
          current: result.state.current_node, intent: result.state.intent, risk: result.state.risk, status: result.state.status })
      }
    } catch { /* ignore */ }
  }

  async function handleCompile() {
    try {
      const result = await window.harness!.compileWorkflow('local', intent, risk)
      setCompileResult(result)
    } catch { /* ignore */ }
  }

  React.useEffect(() => { loadWorkflow() }, [])

  return (
    <div style={{ padding: 24 }}>
      <h2>Workflow</h2>
      {stats && (
        <div style={{ margin: '12px 0', padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><strong>Run:</strong> {stats.status}</span>
            <span><strong>Intent:</strong> {stats.intent}</span>
            <span><strong>Risk:</strong> {stats.risk}</span>
            <span><strong>Current:</strong> {stats.current}</span>
            <span><strong>Progress:</strong> {stats.completed}/{stats.total}</span>
          </div>
          <div style={{ marginTop: 8, height: 8, background: '#eee', borderRadius: 4 }}>
            <div style={{ height: 8, borderRadius: 4, background: '#4caf50', width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Simulate Route</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select value={intent} onChange={e => setIntent(e.target.value)} style={{ padding: 6 }}>{INTENTS.map(i => <option key={i}>{i}</option>)}</select>
          <select value={risk} onChange={e => setRisk(e.target.value)} style={{ padding: 6 }}>{RISKS.map(r => <option key={r}>{r}</option>)}</select>
          <button onClick={handleCompile} style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Simulate</button>
        </div>
        {compileResult && (
          <div style={{ marginTop: 12 }}>
            {compileResult.required_nodes ? (
              <div>
                <p><strong>Route:</strong> {compileResult.required_nodes.length} nodes</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {compileResult.required_nodes.map((n: string, i: number) => (
                    <span key={i} style={{ padding: '2px 8px', background: '#e3f2fd', borderRadius: 4, fontSize: 12 }}>{n}</span>
                  ))}
                </div>
              </div>
            ) : <p style={{ color: 'red' }}>{compileResult.error || 'Compile failed'}</p>}
          </div>
        )}
      </div>

      {nodes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>All Nodes ({nodes.length})</h3>
          {nodes.map((n: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderBottom: '1px solid #eee', fontSize: 13 }}>
              <span style={{ minWidth: 24, color: '#999' }}>{i + 1}</span>
              <span style={{ fontWeight: 500, minWidth: 220 }}>{n.id}</span>
              <span style={{ color: '#666' }}>{n.role}</span>
              <span style={{ fontSize: 12, color: '#999' }}>→ {n.artifact}</span>
              {n.gates?.length > 0 && <span style={{ fontSize: 11, background: '#fff3cd', padding: '1px 6px', borderRadius: 4 }}>{n.gates.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
