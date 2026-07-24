import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { Download, FileUp, Redo2, RefreshCw, Save, Undo2 } from 'lucide-react'
import type { WorkflowNode } from '../../app/harness-api'
import { WorkflowCanvas } from '../workflow-studio/WorkflowCanvas'
import { NodeCatalog } from '../workflow-studio/NodeCatalog'
import { RouteEditor } from '../workflow-studio/RouteEditor'
import { DiagnosticsPanel } from '../workflow-studio/DiagnosticsPanel'
import { WorkflowInspector } from '../workflow-studio/WorkflowInspector'
import { useWorkflowDraft } from '../workflow-studio/useWorkflowDraft'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

type StudioTab = 'routes' | 'nodes' | 'recovery' | 'rules' | 'yaml' | 'versions'
interface WorkflowData {
  nodes: WorkflowNode[]
  routes: Record<string, Record<string, string[]>>
  state: { run_id: string; status: string; intent: string; risk: string; current_node: string; completed_nodes: string[]; required_nodes: string[] }
  roles: string[]
  gate_definitions: Record<string, unknown>
  gate_meanings: Record<string, string>
  hard_rules: Record<string, unknown>
  effective_hard_rules: Record<string, unknown>
  failure_recovery: { max_auto_retries_per_gate?: number; gate_to_node?: Record<string, string> }
  yaml: string
  hash: string
}
interface PreviewData {
  success: boolean; yaml?: string; base_hash?: string; diagnostics?: Array<{ code: string; severity: string; pointer: string; message: string }>
  diff?: unknown; error?: string
  structured?: { nodes?: WorkflowNode[]; routes?: WorkflowData['routes']; hard_rules?: Record<string, unknown>; failure_recovery?: WorkflowData['failure_recovery']; gate_meanings?: Record<string, string> }
}
interface WorkflowVersion { id: number; content_hash: string; author: string; summary: string; created_at: string }

function cloneRoutes(routes: WorkflowData['routes']): WorkflowData['routes'] {
  return Object.fromEntries(Object.entries(routes).map(([intent, risks]) => [intent, Object.fromEntries(Object.entries(risks).map(([risk, route]) => [risk, [...route]]))]))
}

function WorkflowContent(): React.ReactElement {
  const { selectedProjectId, selectedRun } = useWorkspace()
  const [data, setData] = useState<WorkflowData>()
  const [catalog, setCatalog] = useState<WorkflowNode[]>([])
  const [, setRoutes] = useState<WorkflowData['routes']>({})
  const routesRef = useRef<WorkflowData['routes']>({})
  const [recovery, setRecovery] = useState<WorkflowData['failure_recovery']>({})
  const [yamlDraft, setYamlDraft] = useState('')
  const [preview, setPreview] = useState<PreviewData>()
  const [versions, setVersions] = useState<WorkflowVersion[]>([])
  const [tab, setTab] = useState<StudioTab>('routes')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const draft = useWorkflowDraft()

  const load = useCallback(async () => {
    if (!window.harness) return
    setBusy(true); setMessage(''); setPreview(undefined)
    try {
      const [workflow, history] = await Promise.all([
        window.harness.getWorkflow(selectedProjectId, selectedRun?.run_id),
        window.harness.listWorkflowVersions(selectedProjectId),
      ])
      if (workflow.error) throw new Error(String(workflow.error))
      const loaded = workflow as unknown as WorkflowData
      const copiedRoutes = cloneRoutes(loaded.routes)
      setData(loaded); setCatalog(loaded.nodes); setRoutes(copiedRoutes); routesRef.current = copiedRoutes
      setRecovery(structuredClone(loaded.failure_recovery || {})); setYamlDraft(loaded.yaml)
      setVersions(Array.isArray(history) ? history as WorkflowVersion[] : [])
      const ids = copiedRoutes[draft.selectedIntent]?.[draft.selectedRisk] || []
      const byId = new Map(loaded.nodes.map((node) => [node.id, node]))
      draft.setNodes(ids.map((id) => byId.get(id)).filter((node): node is WorkflowNode => Boolean(node)))
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workflow load failed') }
    finally { setBusy(false) }
  }, [selectedProjectId, selectedRun?.run_id])

  useEffect(() => { void load() }, [load])

  function saveCurrentRoute(target = routesRef.current): WorkflowData['routes'] {
    const next = cloneRoutes(target)
    next[draft.selectedIntent] ||= {}
    next[draft.selectedIntent][draft.selectedRisk] = draft.nodes.map((node) => node.id)
    routesRef.current = next
    setRoutes(next)
    return next
  }

  function selectRoute(intent: string, risk: string): void {
    const next = saveCurrentRoute()
    const byId = new Map([...catalog, ...draft.nodes].map((node) => [node.id, node]))
    draft.setNodes((next[intent]?.[risk] || []).map((id) => byId.get(id)).filter((node): node is WorkflowNode => Boolean(node)))
  }

  function mergedCatalog(): WorkflowNode[] {
    const merged = new Map(catalog.map((node) => [node.id, node]))
    for (const node of draft.nodes) merged.set(node.id, node)
    return [...merged.values()]
  }

  const lockedIds = useMemo(() => {
    const effective = data?.effective_hard_rules || {}
    const ids = new Set<string>()
    for (const value of Object.values(effective)) if (Array.isArray(value)) for (const item of value) if (typeof item === 'string' && catalog.some((node) => node.id === item)) ids.add(item)
    return ids
  }, [catalog, data?.effective_hard_rules])

  async function previewStructured(): Promise<void> {
    if (!window.harness || !data) return
    setBusy(true); setMessage('')
    try {
      const allRoutes = saveCurrentRoute()
      const result = await window.harness.previewWorkflow(selectedProjectId, mergedCatalog(), draft.selectedIntent, draft.selectedRisk, draft.nodes.map((node) => node.id), {
        routes: allRoutes, hardRules: data.hard_rules, failureRecovery: recovery, gateMeanings: data.gate_meanings,
      }) as unknown as PreviewData
      setPreview(result); draft.setDiagnostics(result.diagnostics || [])
      if (result.yaml) setYamlDraft(result.yaml)
      if (!result.success) setMessage(result.error || 'Workflow preview failed')
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Workflow preview failed') }
    finally { setBusy(false) }
  }

  async function previewYaml(yaml = yamlDraft): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.previewWorkflowYaml(selectedProjectId, yaml) as unknown as PreviewData
      setPreview(result); draft.setDiagnostics(result.diagnostics || [])
      if (result.success && result.structured?.nodes && result.structured.routes) {
        const nextRoutes = cloneRoutes(result.structured.routes)
        setCatalog(result.structured.nodes); setRoutes(nextRoutes); routesRef.current = nextRoutes
        setRecovery(structuredClone(result.structured.failure_recovery || {}))
        setData((current) => current ? {
          ...current,
          nodes: result.structured!.nodes!, routes: nextRoutes,
          hard_rules: result.structured!.hard_rules || {},
          failure_recovery: result.structured!.failure_recovery || {},
          gate_meanings: result.structured!.gate_meanings || {},
        } : current)
        const byId = new Map(result.structured.nodes.map((node) => [node.id, node]))
        draft.setNodes((nextRoutes[draft.selectedIntent]?.[draft.selectedRisk] || []).map((id) => byId.get(id)).filter((node): node is WorkflowNode => Boolean(node)))
      }
      if (!result.success) setMessage(result.error || 'YAML validation failed')
    } finally { setBusy(false) }
  }

  async function applyPreview(): Promise<void> {
    if (!window.harness || !preview?.yaml || !preview.base_hash) return
    const result = await window.harness.applyWorkflow(selectedProjectId, preview.yaml, preview.base_hash)
    if (!result.success) { setMessage(String(result.error || 'Workflow apply failed')); return }
    setMessage('Workflow applied. Existing runs retain their frozen routes.')
    await load()
  }

  async function importWorkflow(): Promise<void> {
    const result = await window.harness?.importWorkflow(selectedProjectId) as PreviewData | undefined
    if (!result || result.error) { if (result?.error !== 'cancelled') setMessage(String(result?.error)); return }
    setPreview(result)
    if (result.yaml) { setYamlDraft(result.yaml); setTab('yaml') }
  }

  async function restore(version: WorkflowVersion): Promise<void> {
    if (!window.harness || !data || !window.confirm(`Restore workflow version ${version.id}?`)) return
    const result = await window.harness.restoreWorkflowVersion(selectedProjectId, version.id, data.hash)
    if (!result.success) { setMessage(String(result.error || 'Restore failed')); return }
    setMessage(`Workflow version ${version.id} restored.`); await load()
  }

  function createNode(): void {
    let index = catalog.length + 1
    let id = `CUSTOM_NODE_${index}`
    while (catalog.some((node) => node.id === id)) id = `CUSTOM_NODE_${++index}`
    const node = { id, role: data?.roles[0] || 'developer', artifact: `${String(index).padStart(2, '0')}-custom-node.md`, gates: [] }
    setCatalog((current) => [...current, node]); draft.addNode(node); draft.selectNode(id)
  }

  const tabs: Array<[StudioTab, string]> = [['routes', 'Routes'], ['nodes', 'Nodes'], ['recovery', 'Recovery'], ['rules', 'Rules'], ['yaml', 'YAML'], ['versions', 'Versions']]
  return <section className="page workflow-studio-page">
    <header className="page-header"><div><h1>Workflow Studio</h1>{selectedRun && <span className="muted mono">Run {selectedRun.run_id} · frozen {selectedRun.required_nodes.length} nodes</span>}</div><div className="actions">
      <button className="button icon-button" onClick={() => void load()} title="Refresh workflow"><RefreshCw size={15} /></button>
      <button className="button" onClick={() => void importWorkflow()}><FileUp size={15} />Import</button>
      <button className="button" onClick={() => void window.harness?.exportWorkflow(selectedProjectId, 'yaml')}><Download size={15} />YAML</button>
      <button className="button" onClick={() => void window.harness?.exportWorkflow(selectedProjectId, 'zip')}><Download size={15} />ZIP</button>
      <button className="button primary" disabled={busy} onClick={() => void (tab === 'yaml' ? previewYaml() : previewStructured())}>Preview</button>
      <button className="button primary" disabled={busy || !preview?.success} onClick={() => void applyPreview()}><Save size={15} />Apply</button>
    </div></header>
    {message && <div className={message.startsWith('Workflow') ? 'notice success' : 'notice error'}>{message}</div>}
    <div className="studio-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'routes' && data && <ReactFlowProvider><RouteEditor onSelect={selectRoute} /><div className="studio-grid">
      <NodeCatalog nodes={mergedCatalog()} lockedIds={lockedIds} onCreateNode={createNode} onAddNode={(nodeId) => { const node = mergedCatalog().find((item) => item.id === nodeId); if (node) draft.addNode(node) }} />
      <div className="studio-canvas"><div className="canvas-toolbar"><span>{draft.selectedIntent} / {draft.selectedRisk}</span><div className="actions"><button className="button icon-button" onClick={draft.undo} title="Undo"><Undo2 size={15} /></button><button className="button icon-button" onClick={draft.redo} title="Redo"><Redo2 size={15} /></button></div></div><WorkflowCanvas /><DiagnosticsPanel /></div>
      <WorkflowInspector roles={data.roles} gateIds={Object.keys(data.gate_definitions)} lockedIds={lockedIds} />
    </div></ReactFlowProvider>}
    {tab === 'nodes' && <div className="studio-table"><table className="data-table"><thead><tr><th>ID</th><th>Role</th><th>Artifact</th><th>Gates</th></tr></thead><tbody>{mergedCatalog().map((node) => <tr key={node.id}><td className="mono">{node.id}</td><td>{node.role}</td><td className="mono">{node.artifact}</td><td>{node.gates.join(', ') || '-'}</td></tr>)}</tbody></table></div>}
    {tab === 'recovery' && data && <div className="configuration-pane"><label className="field">Maximum automatic retries<input type="number" min="0" max="10" value={recovery.max_auto_retries_per_gate ?? 2} onChange={(event) => setRecovery((current) => ({ ...current, max_auto_retries_per_gate: Number(event.target.value) }))} /></label><table className="data-table"><thead><tr><th>Gate</th><th>Recovery node</th></tr></thead><tbody>{Object.keys(data.gate_definitions).map((gate) => <tr key={gate}><td>{gate}</td><td><select value={recovery.gate_to_node?.[gate] || ''} onChange={(event) => setRecovery((current) => ({ ...current, gate_to_node: { ...current.gate_to_node, [gate]: event.target.value } }))}><option value="">None</option>{catalog.map((node) => <option key={node.id}>{node.id}</option>)}</select></td></tr>)}</tbody></table></div>}
    {tab === 'rules' && data && <div className="rules-grid"><section><h2>Project hard rules</h2><pre>{JSON.stringify(data.hard_rules, null, 2)}</pre></section><section><h2>Effective hard rules</h2><pre>{JSON.stringify(data.effective_hard_rules, null, 2)}</pre></section></div>}
    {tab === 'yaml' && <div className="yaml-editor"><textarea spellCheck={false} value={yamlDraft} onChange={(event) => { setYamlDraft(event.target.value); setPreview(undefined) }} /><DiagnosticsPanel /></div>}
    {tab === 'versions' && <div className="studio-table"><table className="data-table"><thead><tr><th>Version</th><th>Hash</th><th>Author</th><th>Summary</th><th>Created</th><th /></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><td>#{version.id}</td><td className="mono">{version.content_hash.slice(0, 12)}</td><td>{version.author}</td><td>{version.summary}</td><td>{new Date(version.created_at).toLocaleString()}</td><td><button className="button" onClick={() => void restore(version)}>Restore</button></td></tr>)}</tbody></table></div>}
    {Boolean(preview?.diff) && <details className="semantic-diff" open><summary>Semantic diff</summary><pre>{JSON.stringify(preview?.diff, null, 2)}</pre></details>}
  </section>
}

export function WorkflowPage(): React.ReactElement { return <ProjectRequired><WorkflowContent /></ProjectRequired> }
