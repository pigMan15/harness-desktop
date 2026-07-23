import React, { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import type { WorkflowNode } from '../../app/harness-api'
import { WorkflowCanvas } from '../workflow-studio/WorkflowCanvas'
import { NodeCatalog } from '../workflow-studio/NodeCatalog'
import { RouteEditor } from '../workflow-studio/RouteEditor'
import { DiagnosticsPanel } from '../workflow-studio/DiagnosticsPanel'
import { useWorkflowDraft } from '../workflow-studio/useWorkflowDraft'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

interface WorkflowData {
  nodes: WorkflowNode[]
  routes: Record<string, Record<string, string[]>>
  state: { run_id: string; status: string; intent: string; risk: string; current_node: string; completed_nodes: string[]; required_nodes: string[] }
  yaml: string
  hash: string
}

interface PreviewData {
  success: boolean
  yaml?: string
  base_hash?: string
  diagnostics?: Array<{ code: string; severity: string; pointer: string; message: string }>
  diff?: { nodes?: { added?: string[]; removed?: string[]; modified?: string[] }; routes?: { changed?: string[] } }
  error?: string
}

function WorkflowContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const [data, setData] = useState<WorkflowData>()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [preview, setPreview] = useState<PreviewData>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedIntent = useWorkflowDraft((state) => state.selectedIntent)
  const selectedRisk = useWorkflowDraft((state) => state.selectedRisk)

  const load = useCallback(async () => {
    if (!window.harness) return
    setBusy(true); setMessage(''); setPreview(undefined)
    try {
      const result = await window.harness.getWorkflow(selectedProjectId)
      if (result.error) throw new Error(String(result.error))
      setData(result as unknown as WorkflowData)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workflow load failed') }
    finally { setBusy(false) }
  }, [selectedProjectId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!data || mode !== 'edit') return
    const byId = new Map(data.nodes.map((node) => [node.id, node]))
    const route = data.routes[selectedIntent]?.[selectedRisk] || []
    useWorkflowDraft.getState().setNodes(route.map((id) => byId.get(id)).filter((node): node is WorkflowNode => Boolean(node)))
    setPreview(undefined)
  }, [data, mode, selectedIntent, selectedRisk])

  async function previewRoute(): Promise<void> {
    if (!window.harness || !data) return
    const draft = useWorkflowDraft.getState()
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.previewWorkflow(
        selectedProjectId,
        data.nodes,
        draft.selectedIntent,
        draft.selectedRisk,
        draft.nodes.map((node) => node.id),
      ) as unknown as PreviewData
      setPreview(result)
      draft.setDiagnostics(result.diagnostics || [])
      if (!result.success) setMessage(result.error || 'Workflow preview failed')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workflow preview failed') }
    finally { setBusy(false) }
  }

  async function applyPreview(): Promise<void> {
    if (!window.harness || !preview?.yaml || !preview.base_hash) return
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.applyWorkflow(selectedProjectId, preview.yaml, preview.base_hash)
      if (!result.success) throw new Error(String(result.error || 'Workflow apply failed'))
      setMessage('Workflow updated. New tasks will use this route configuration.')
      await load()
      setMode('view')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workflow apply failed') }
    finally { setBusy(false) }
  }

  const activeRoute = data?.state.required_nodes || []
  return (
    <section className="page">
      <header className="page-header"><h1>Workflow</h1><div className="actions">
        <button className="button icon-button" onClick={() => void load()} title="Refresh workflow">R</button>
        <div className="actions" style={{ border: '1px solid #c8ccd1', borderRadius: 6, padding: 2 }}>
          <button className={`button ${mode === 'view' ? 'primary' : ''}`} onClick={() => setMode('view')}>View</button>
          <button className={`button ${mode === 'edit' ? 'primary' : ''}`} onClick={() => setMode('edit')}>Edit</button>
        </div>
        {mode === 'edit' && <button className="button primary" disabled={busy} onClick={() => void previewRoute()}>Preview</button>}
        {mode === 'edit' && preview?.success && <button className="button" disabled={busy} onClick={() => void applyPreview()}>Apply</button>}
      </div></header>
      {message && <div className={message.startsWith('Workflow updated') ? 'notice' : 'notice error'}>{message}</div>}
      {data?.state && <div className="panel toolbar">
        <span className="badge success">ACTIVE RUN</span><strong className="mono">{data.state.run_id}</strong>
        <span className="muted">{data.state.intent} / {data.state.risk}</span><span className="muted">Node {data.state.current_node}</span>
        <span className="muted">Frozen route: {activeRoute.length} nodes</span>
      </div>}
      {mode === 'view' ? <div className="panel" style={{ marginTop: 14 }}>
        <table className="data-table"><thead><tr><th>#</th><th>Node</th><th>Role</th><th>Artifact</th><th>Gates</th></tr></thead>
          <tbody>{activeRoute.map((id, index) => {
            const node = data?.nodes.find((item) => item.id === id)
            return <tr key={id}><td>{index + 1}</td><td><strong>{id}</strong></td><td>{node?.role}</td><td className="mono muted">{node?.artifact}</td><td>{node?.gates?.join(', ') || '-'}</td></tr>
          })}</tbody></table>
      </div> : <ReactFlowProvider><div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr)', gap: 14, marginTop: 14 }}>
        <div><NodeCatalog onAddNode={(nodeId) => {
          const node = data?.nodes.find((item) => item.id === nodeId)
          if (node) useWorkflowDraft.getState().addNode(node)
        }} /><div className="panel" style={{ marginTop: 10, padding: 10 }}><RouteEditor /></div><DiagnosticsPanel />
          {preview?.diff && <div className="panel" style={{ marginTop: 10, padding: 10, fontSize: 12 }}><strong>Semantic diff</strong><div className="muted">Routes: {preview.diff.routes?.changed?.join(', ') || 'none'}</div></div>}
        </div><WorkflowCanvas />
      </div></ReactFlowProvider>}
    </section>
  )
}

export function WorkflowPage(): React.ReactElement { return <ProjectRequired><WorkflowContent /></ProjectRequired> }
