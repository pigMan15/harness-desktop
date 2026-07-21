/**
 * Workflow Canvas — React Flow-based visual workflow editor.
 *
 * Displays nodes as a linear chain. Supports drag-to-reorder.
 * System minimum nodes (from SYSTEM_MINIMUM_RULES) show lock icon.
 */
import React, { useCallback, useMemo } from 'react'
import ReactFlow, { Background, Controls, Edge, Node, useEdgesState, useNodesState } from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowDraft } from './useWorkflowDraft'

const SYSTEM_NODES = new Set([
  'COMPILE', 'UNIT_TEST', 'EVIDENCE_CAPTURE',
  'REQUIREMENT_CONFIRMATION', 'SOLUTION_CONFIRMATION',
  'PRE_MORTEM', 'ACCEPTANCE_CONFIRMATION',
  'PRERELEASE_DEPLOYMENT', 'INTERFACE_TEST',
  'KNOWLEDGE_PROMOTION',
])

function toFlowNodes(nodes: Array<{ id: string; role: string }>): Node[] {
  return nodes.map((n, i) => ({
    id: n.id,
    position: { x: 50, y: i * 80 + 20 },
    data: {
      label: `${n.id}`,
      role: n.role,
      locked: SYSTEM_NODES.has(n.id),
    },
    type: 'default',
  }))
}

export function WorkflowCanvas(): React.ReactElement {
  const { nodes, reorderNode } = useWorkflowDraft()

  const flowNodes = useMemo(() => toFlowNodes(nodes), [nodes])

  const [rnodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges] = useEdgesState(
    flowNodes.slice(0, -1).map((_, i) => ({
      id: `e-${i}`,
      source: flowNodes[i].id,
      target: flowNodes[i + 1].id,
      type: 'smoothstep',
      animated: false,
    })),
  )

  // Sync external state changes into React Flow
  React.useEffect(() => {
    setNodes(toFlowNodes(nodes))
  }, [nodes, setNodes])

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const fromIdx = nodes.findIndex((n) => n.id === node.id)
      const toIdx = Math.round((node.position.y - 20) / 80)
      if (toIdx >= 0 && toIdx < nodes.length && toIdx !== fromIdx) {
        reorderNode(fromIdx, toIdx)
      }
    },
    [nodes, reorderNode],
  )

  return (
    <div style={{ height: 600, border: '1px solid #ddd', borderRadius: 8 }}>
      <ReactFlow nodes={rnodes} edges={edges} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
