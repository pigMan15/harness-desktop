import React, { useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { WorkflowCanvas } from '../workflow-studio/WorkflowCanvas'
import { NodeCatalog } from '../workflow-studio/NodeCatalog'
import { RouteEditor } from '../workflow-studio/RouteEditor'
import { DiagnosticsPanel } from '../workflow-studio/DiagnosticsPanel'
import { useWorkflowDraft } from '../workflow-studio/useWorkflowDraft'

export function WorkflowPage(): React.ReactElement {
  const [stats, setStats] = useState<any>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  async function loadWorkflow() {
    try {
      const result = await window.harness!.getWorkflow('local')
      if (result?.state) {
        setStats({
          total: result.state.required_nodes?.length || 0,
          completed: result.state.completed_nodes?.length || 0,
          current: result.state.current_node, intent: result.state.intent,
          risk: result.state.risk, status: result.state.status,
        })
      }
      if (mode === 'edit' && result?.nodes) {
        useWorkflowDraft.getState().setNodes(result.nodes.map((n: any) => ({
          id: n.id, role: n.role, artifact: n.artifact, gates: n.gates || [],
        })))
      }
    } catch { /* */ }
  }

  async function handleCompile() {
    try {
      const { selectedIntent, selectedRisk, setDiagnostics } = useWorkflowDraft.getState()
      const result = await window.harness!.compileWorkflow('local', selectedIntent, selectedRisk)
      if (result?.required_nodes) {
        setDiagnostics([{ code: 'OK', severity: 'warning', pointer: '/', message: `Route compiled: ${result.required_nodes.length} nodes` }])
      } else if (result?.error) {
        setDiagnostics([{ code: 'ERROR', severity: 'error', pointer: '/', message: result.error }])
      } else {
        setDiagnostics((result?.diagnostics || []).map((d: any) => ({ code: d.code, severity: d.severity, pointer: d.pointer, message: d.message })))
      }
    } catch { /* */ }
  }

  React.useEffect(() => { loadWorkflow() }, [])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Workflow Studio</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
            style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 6 }}>
            {mode === 'view' ? '✏ Edit' : '👁 View'}
          </button>
          {mode === 'edit' && (
            <button onClick={handleCompile}
              style={{ padding: '8px 16px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Compile
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div style={{ margin: '12px 0', padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span><strong>Run:</strong> {stats.status}</span>
            <span><strong>Intent:</strong> {stats.intent}</span>
            <span><strong>Risk:</strong> {stats.risk}</span>
            <span><strong>Current:</strong> {stats.current}</span>
            <span><strong>Progress:</strong> {stats.completed}/{stats.total}</span>
          </div>
          <div style={{ marginTop: 8, height: 6, background: '#eee', borderRadius: 3 }}>
            <div style={{ height: 6, borderRadius: 3, background: '#4caf50', width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} />
          </div>
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
              <div style={{ marginTop: 12 }}>
                <RouteEditor />
              </div>
              <DiagnosticsPanel />
            </div>
            <div style={{ flex: 1 }}>
              <WorkflowCanvas />
            </div>
          </div>
        </ReactFlowProvider>
      ) : (
        <NodeList />
      )}
    </div>
  )
}

function NodeList(): React.ReactElement {
  const [nodes, setNodes] = useState<any[]>([])
  React.useEffect(() => {
    window.harness?.getWorkflow('local').then(r => { if (r?.nodes) setNodes(r.nodes) }).catch(() => {})
  }, [])
  return (
    <div style={{ marginTop: 16 }}>
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
  )
}
