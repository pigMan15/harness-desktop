/**
 * Workflow Canvas — React Flow visual editor with drag-to-add from NodeCatalog.
 */
import React, { useMemo, useCallback } from 'react'
import ReactFlow, { Background, Controls, Node, Edge, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowDraft } from './useWorkflowDraft'

const SYSTEM_NODES = new Set(['COMPILE','UNIT_TEST','EVIDENCE_CAPTURE','REQUIREMENT_CONFIRMATION','SOLUTION_CONFIRMATION','PRE_MORTEM','ACCEPTANCE_CONFIRMATION','PRERELEASE_DEPLOYMENT','INTERFACE_TEST','KNOWLEDGE_PROMOTION'])

const NODE_ROLES: Record<string, string> = {
  INTAKE:'dispatcher',CONTEXT_PACK:'requirement-analyst',REQUIREMENT_REVIEW:'requirement-analyst',
  REQUIREMENT_CONFIRMATION:'orchestrator',SOLUTION_DESIGN:'tech-architect',SOLUTION_CONFIRMATION:'orchestrator',
  PRE_MORTEM:'quality-guardian',IMPLEMENTATION_PLAN:'plan-generator',ACCEPTANCE_CONFIRMATION:'orchestrator',
  CHANGE_REQUEST:'state-keeper',BRANCH_CREATION:'state-keeper',WORKTREE_CREATION:'state-keeper',
  CODING_DESIGN_CONFIRMATION:'developer',DEVELOPMENT:'developer',COMPILE:'verifier',UNIT_TEST:'verifier',
  ATDD:'verifier',EVIDENCE_CAPTURE:'verifier',PRERELEASE_DEPLOYMENT:'deployer',INTERFACE_TEST:'tester',
  ACCEPTANCE_REPORT:'orchestrator',KNOWLEDGE_PROMOTION:'knowledge-keeper',
}

export function WorkflowCanvas(): React.ReactElement {
  const { nodes, addNode, reorderNode } = useWorkflowDraft()
  const { screenToFlowPosition } = useReactFlow()

  const flowNodes: Node[] = useMemo(() =>
    nodes.map((n, i) => ({
      id: n.id, position: { x: 100, y: i * 80 + 20 },
      data: { label: n.id, role: n.role },
      type: 'default',
      style: SYSTEM_NODES.has(n.id) ? { background: '#fff3cd', border: '1px solid #ffc107' } : undefined,
    })), [nodes])

  const flowEdges: Edge[] = useMemo(() =>
    flowNodes.slice(0, -1).map((_, i) => ({ id: `e${i}`, source: flowNodes[i].id, target: flowNodes[i+1].id, type: 'smoothstep' })),
    [flowNodes])

  // Handle drag-drop from NodeCatalog
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('application/reactflow')
    if (!nodeId) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const idx = Math.round((pos.y - 20) / 80)
    const role = NODE_ROLES[nodeId] || 'developer'
    const artifact = `${String(nodes.length).padStart(2,'0')}-${nodeId.toLowerCase()}.md`
    addNode({ id: nodeId, role, artifact, gates: [] }, Math.max(0, Math.min(nodes.length, idx)))
  }, [screenToFlowPosition, nodes.length, addNode])

  const onNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
    const from = nodes.findIndex(n => n.id === node.id)
    const to = Math.round((node.position.y - 20) / 80)
    if (to >= 0 && to < nodes.length && to !== from) reorderNode(from, to)
  }, [nodes, reorderNode])

  if (nodes.length === 0) return (
    <div style={{ height:600,display:'flex',alignItems:'center',justifyContent:'center',background:'#fafafa',border:'1px solid #ddd',borderRadius:8,color:'#999' }}>
      No nodes in this route.
    </div>
  )

  return (
    <div style={{ height:600, border:'1px solid #ddd',borderRadius:8 }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow nodes={flowNodes} edges={flowEdges} onNodeDragStop={onNodeDragStop} fitView nodesDraggable>
        <Background /><Controls />
      </ReactFlow>
    </div>
  )
}
