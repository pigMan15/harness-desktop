import React, { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { WorkflowCanvas } from '../workflow-studio/WorkflowCanvas'
import { NodeCatalog } from '../workflow-studio/NodeCatalog'
import { RouteEditor } from '../workflow-studio/RouteEditor'
import { DiagnosticsPanel } from '../workflow-studio/DiagnosticsPanel'
import { useWorkflowDraft } from '../workflow-studio/useWorkflowDraft'

export function WorkflowPage(): React.ReactElement {
  const [data, setData] = useState<any>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [msg, setMsg] = useState('')

  const loadIntoDraft = useCallback(() => {
    if (!data?.nodes) return
    useWorkflowDraft.getState().setNodes(
      data.nodes.map((n: any) => ({ id: n.id, role: n.role, artifact: n.artifact, gates: n.gates || [] }))
    )
  }, [data])

  useEffect(() => {
    window.harness?.getWorkflow('local').then(r => {
      if (r && !r.error) setData(r); else setMsg(r?.error || 'Failed')
    }).catch((e: any) => setMsg(e.message))
  }, [])

  useEffect(() => { if (mode === 'edit') loadIntoDraft() }, [mode, loadIntoDraft])

  async function handleCompile() {
    const { selectedIntent, selectedRisk, setDiagnostics } = useWorkflowDraft.getState()
    try {
      const r = await window.harness!.compileWorkflow('local', selectedIntent, selectedRisk)
      if (r?.required_nodes) {
        setDiagnostics([{ code: 'OK', severity: 'warning', pointer: '/', message: `Route: ${r.required_nodes.length} nodes` }])
      } else if (r?.error) {
        setDiagnostics([{ code: 'ERROR', severity: 'error', pointer: '/', message: r.error }])
      }
    } catch (e: any) { setDiagnostics([{ code: 'ERROR', severity: 'error', pointer: '/', message: e.message }]) }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Workflow Studio</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
            style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 6 }}>
            {mode === 'view' ? 'Edit Canvas' : 'View List'}
          </button>
          {mode === 'edit' && (
            <button onClick={handleCompile}
              style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Compile
            </button>
          )}
        </div>
      </div>

      {msg && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{msg}</p>}

      {data?.state && (
        <div style={{ margin: '12px 0', padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8, display: 'flex', gap: 16, fontSize: 13 }}>
          <span><strong>{data.state.status}</strong></span>
          <span>Intent: {data.state.intent}</span>
          <span>Risk: {data.state.risk}</span>
          <span>Node: {data.state.current_node}</span>
          <span>{data.state.completed_nodes?.length || 0}/{data.state.required_nodes?.length || 0}</span>
        </div>
      )}

      {mode === 'edit' ? (
        <ReactFlowProvider>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 220 }}>
              <NodeCatalog onAddNode={(nodeId) => {
                const { addNode, nodes } = useWorkflowDraft.getState()
                addNode({ id: nodeId, role: 'developer', artifact: 'custom.md', gates: [] }, nodes.length)
              }} />
              <div style={{ marginTop: 12 }}><RouteEditor /></div>
              <DiagnosticsPanel />
            </div>
            <div style={{ flex: 1 }}><WorkflowCanvas /></div>
          </div>
        </ReactFlowProvider>
      ) : (
        data?.nodes && (
          <div style={{ marginTop: 16 }}>
            {data.nodes.map((n: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderBottom: '1px solid #eee', fontSize: 13 }}>
                <span style={{ minWidth: 24, color: '#999' }}>{i + 1}</span>
                <span style={{ fontWeight: 500, minWidth: 220 }}>{n.id}</span>
                <span style={{ color: '#666', width: 160 }}>{n.role}</span>
                <span style={{ fontSize: 12, color: '#999' }}>{n.artifact}</span>
                {n.gates?.length > 0 && <span style={{ fontSize: 11, background: '#fff3cd', padding: '2px 6px', borderRadius: 4 }}>{n.gates.join(',')}</span>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
