import React, { useMemo, useState } from 'react'
import { LockKeyhole, Plus, Search } from 'lucide-react'
import type { WorkflowNode } from '../../app/harness-api'
import { useLanguage } from '../settings/LanguageContext'

interface Props {
  nodes: WorkflowNode[]
  lockedIds: Set<string>
  onAddNode: (nodeId: string) => void
  onCreateNode: () => void
}

function onDragStart(event: React.DragEvent, nodeId: string): void {
  event.dataTransfer.setData('application/reactflow', nodeId)
  event.dataTransfer.effectAllowed = 'move'
}

export function NodeCatalog({ nodes, lockedIds, onAddNode, onCreateNode }: Props): React.ReactElement {
  const { text } = useLanguage()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => nodes.filter((node) => `${node.id} ${node.role}`.toLowerCase().includes(query.toLowerCase())), [nodes, query])
  return <aside className="studio-catalog">
    <div className="studio-pane-title"><strong>Node Catalog</strong><button className="button icon-button" onClick={onCreateNode} title={text('Create custom node', '创建自定义节点')}><Plus size={15} /></button></div>
    <label className="catalog-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes" /></label>
    <div className="catalog-list">{filtered.map((node) => <button key={node.id} className="catalog-node" draggable onDragStart={(event) => onDragStart(event, node.id)} onClick={() => onAddNode(node.id)}>
      <span><strong>{node.id}</strong><small>{node.role}</small></span>
      {lockedIds.has(node.id) && <LockKeyhole size={13} aria-label="Required by effective rules" />}
    </button>)}</div>
  </aside>
}
