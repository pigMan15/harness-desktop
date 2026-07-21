/**
 * Workflow Canvas — React Flow-based visual workflow editor.
 * Displays nodes as a linear chain derived from the Zustand draft store.
 */
import React, { useMemo, useCallback } from 'react'
import ReactFlow, { Background, Controls, Node, Edge, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowDraft } from './useWorkflowDraft'

const SYSTEM_NODES = new Set([
  'COMPILE', 'UNIT_TEST', 'EVIDENCE_CAPTURE',
  'REQUIREMENT_CONFIRMATION', 'SOLUTION_CONFIRMATION',
  'PRE_MORTEM', 'ACCEPTANCE_CONFIRMATION',
  'PRERELEASE_DEPLOYMENT', 'INTERFACE_TEST',
  'KNOWLEDGE_PROMOTION',
])

export function WorkflowCanvas(): React.ReactElement {
  const { nodes, reorderNode } = useWorkflowDraft()

  // Build React Flow nodes from Zustand store — controlled mode (no useNodesState)
  const flowNodes: Node[] = useMemo(() =>
    nodes.map((n, i) => ({
      id: n.id,
      position: { x: 50, y: i * 80 + 20 },
      data: { label: `${n.id} (${n.role})`, locked: SYSTEM_NODES.has(n.id) },
      type: 'default',
    })),
    [nodes],
  )

  const flowEdges: Edge[] = useMemo(() =>
    flowNodes.slice(0, -1).map((_, i) => ({
      id: `e-${i}`,
      source: flowNodes[i].id,
      target: flowNodes[i + 1].id,
      type: 'smoothstep',
    })),
    [flowNodes],
  )

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const fromIdx = nodes.findIndex(n => n.id === node.id)
      const toIdx = Math.round((node.position.y - 20) / 80)
      if (toIdx >= 0 && toIdx < nodes.length && toIdx !== fromIdx) {
        reorderNode(fromIdx, toIdx)
      }
    },
    [nodes, reorderNode],
  )

  if (nodes.length === 0) {
    return (
      <div style={{ height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', border: '1px solid #ddd', borderRadius: 8, color: '#999' }}>
        No nodes loaded. Click "Refresh" to load workflow data.
      </div>
    )
  }

  return (
    <div style={{ height: 600, border: '1px solid #ddd', borderRadius: 8 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeDragStop={onNodeDragStop}
        fitView
        nodesDraggable
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
