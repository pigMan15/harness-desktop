import React, { useEffect, useState } from 'react'

const INTENTS = ['FEATURE', 'BUG_FIX', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT', 'QUERY']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

export function WorkflowPage(): React.ReactElement {
  const [data, setData] = useState<any>(null)
  const [compileResult, setCompileResult] = useState<any>(null)
  const [intent, setIntent] = useState('FEATURE')
  const [risk, setRisk] = useState('HIGH')
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const r = await window.harness!.getWorkflow('local')
      if (r && !r.error) setData(r)
      else setMsg(r?.error || 'Failed to load')
    } catch (e: any) { setMsg(e.message) }
  }

  useEffect(() => { load() }, [])

  async function handleSimulate() {
    setMsg('Simulating...')
    try {
      const r = await window.harness!.compileWorkflow('local', intent, risk)
      if (r) setCompileResult(r)
      setMsg('')
    } catch (e: any) { setMsg(e.message) }
  }

  useEffect(() => { handleSimulate() }, [intent, risk])

  return (
    <div style={{ padding: 24 }}>
      <h2>Workflow</h2>

      {msg && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{msg}</p>}

      {data?.state && (
        <div style={{ margin: '12px 0', padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span><strong>Run:</strong> {data.state.status}</span>
            <span><strong>Intent:</strong> {data.state.intent}</span>
            <span><strong>Risk:</strong> {data.state.risk}</span>
            <span><strong>Node:</strong> {data.state.current_node}</span>
            <span><strong>Progress:</strong> {data.state.completed_nodes?.length || 0}/{data.state.required_nodes?.length || 0}</span>
          </div>
          <div style={{ marginTop: 8, height: 6, background: '#eee', borderRadius: 3 }}>
            <div style={{ height: 6, borderRadius: 3, background: '#4caf50', width: `${data.state.required_nodes?.length > 0 ? ((data.state.completed_nodes?.length || 0) / data.state.required_nodes.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Route Simulator</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select value={intent} onChange={e => setIntent(e.target.value)} style={{ padding: 6 }}>{INTENTS.map(i => <option key={i}>{i}</option>)}</select>
          <select value={risk} onChange={e => setRisk(e.target.value)} style={{ padding: 6 }}>{RISKS.map(r => <option key={r}>{r}</option>)}</select>
          <button onClick={handleSimulate} style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Simulate</button>
        </div>
        {compileResult?.required_nodes && (
          <div style={{ marginTop: 12 }}>
            <p><strong>Route:</strong> {compileResult.required_nodes.length} nodes</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {compileResult.required_nodes.map((n: string, i: number) => (
                <span key={i} style={{ padding: '3px 8px', background: '#e3f2fd', borderRadius: 4, fontSize: 12 }}>{n}</span>
              ))}
            </div>
          </div>
        )}
        {compileResult?.error && <p style={{ color: 'red' }}>{compileResult.error}</p>}
      </div>

      {data?.nodes && (
        <div style={{ marginTop: 16 }}>
          <h3>All Nodes ({data.nodes.length})</h3>
          {data.nodes.map((n: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderBottom: '1px solid #eee', fontSize: 13 }}>
              <span style={{ minWidth: 24, color: '#999' }}>{i + 1}</span>
              <span style={{ fontWeight: 500, minWidth: 220 }}>{n.id}</span>
              <span style={{ color: '#666' }}>{n.role}</span>
              <span style={{ fontSize: 12, color: '#999' }}>→ {n.artifact}</span>
              {n.gates?.length > 0 && <span style={{ fontSize: 11, background: '#fff3cd', padding: '2px 6px', borderRadius: 4 }}>{n.gates.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
