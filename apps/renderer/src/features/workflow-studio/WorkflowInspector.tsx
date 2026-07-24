import React from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { useWorkflowDraft } from './useWorkflowDraft'

interface Props { roles: string[]; gateIds: string[]; lockedIds: Set<string> }

export function WorkflowInspector({ roles, gateIds, lockedIds }: Props): React.ReactElement {
  const { nodes, selectedNodeId, updateNode, duplicateNode, removeNode } = useWorkflowDraft()
  const node = nodes.find((item) => item.id === selectedNodeId)
  if (!node) return <aside className="studio-inspector"><div className="studio-pane-title"><strong>Inspector</strong></div><p className="muted">Select a route node.</p></aside>
  const locked = lockedIds.has(node.id)
  return <aside className="studio-inspector">
    <div className="studio-pane-title"><strong>Inspector</strong><div className="actions"><button className="button icon-button" onClick={() => duplicateNode(node.id)} title="Duplicate node"><Copy size={14} /></button><button className="button icon-button danger" disabled={locked} onClick={() => removeNode(node.id)} title="Remove node"><Trash2 size={14} /></button></div></div>
    <label className="field">Node ID<input value={node.id} disabled={locked} onChange={(event) => updateNode(node.id, { id: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} /></label>
    <label className="field">Role<select value={node.role} onChange={(event) => updateNode(node.id, { role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
    <label className="field">Artifact<input value={node.artifact} onChange={(event) => updateNode(node.id, { artifact: event.target.value })} /></label>
    <fieldset className="gate-checks"><legend>Gates</legend>{gateIds.map((gate) => <label key={gate}><input type="checkbox" checked={node.gates.includes(gate)} onChange={(event) => updateNode(node.id, { gates: event.target.checked ? [...node.gates, gate] : node.gates.filter((item) => item !== gate) })} />{gate}</label>)}</fieldset>
  </aside>
}
