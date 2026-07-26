/**
 * Workflow Canvas — React Flow visual editor with drag-to-add from NodeCatalog.
 */
import React, { useCallback, useEffect } from 'react'
import ReactFlow, { Background, Connection, Controls, Edge, Node, useNodesState, useReactFlow } from 'reactflow'
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
  const { nodes, edges, addNode, addEdge, removeEdge, reorderNode, selectedNodeId, selectNode } = useWorkflowDraft()
  const { screenToFlowPosition } = useReactFlow()
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([])

  useEffect(() => {
    setFlowNodes(nodes.map((n, i) => {
      return {
        id: n.id,
        position: { x: 100, y: i * 80 + 20 },
        data: { label: n.id, role: n.role },
        type: 'default',
        selected: n.id === selectedNodeId,
        style: SYSTEM_NODES.has(n.id) ? { background: '#fff3cd', border: '1px solid #ffc107' } : undefined,
      }
    }))
  }, [nodes, selectedNodeId, setFlowNodes])

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: !edge.id.startsWith('seq-'),
    style: edge.id.startsWith('seq-') ? undefined : { stroke: '#1769aa', strokeWidth: 2 },
  }))

  // Handle drag-drop from NodeCatalog
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('application/reactflow')
    if (!nodeId) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const idx = Math.round((pos.y - 20) / 80)
    if (nodes.some((node) => node.id === nodeId)) {
      const decision = window.prompt(`${nodeId} is already in this route. Type before, after, replace, or cancel.`, 'cancel')
      if (!decision || decision.toLowerCase() === 'cancel') return
      const currentIndex = nodes.findIndex((node) => node.id === nodeId)
      const targetIndex = Math.max(0, Math.min(nodes.length - 1, idx))
      if (decision.toLowerCase() === 'before') reorderNode(currentIndex, targetIndex)
      if (decision.toLowerCase() === 'after') reorderNode(currentIndex, Math.min(nodes.length - 1, targetIndex + 1))
      if (decision.toLowerCase() === 'replace') reorderNode(currentIndex, targetIndex)
      return
    }
    const role = NODE_ROLES[nodeId] || 'developer'
    const artifact = `${String(nodes.length).padStart(2,'0')}-${nodeId.toLowerCase()}.md`
    addNode({ id: nodeId, role, artifact, gates: [] }, Math.max(0, Math.min(nodes.length, idx)))
  }, [screenToFlowPosition, nodes, addNode, reorderNode])

  const onNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
    const from = nodes.findIndex(n => n.id === node.id)
    const to = flowNodes
      .map((item) => ({ id: item.id, y: item.id === node.id ? node.position.y : item.position.y }))
      .sort((a, b) => a.y - b.y)
      .findIndex((item) => item.id === node.id)
    if (to >= 0 && to < nodes.length && to !== from) reorderNode(from, to)
  }, [flowNodes, nodes, reorderNode])

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) addEdge(connection.source, connection.target)
  }, [addEdge])

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (window.confirm(`Delete connection ${edge.source} -> ${edge.target}?`)) removeEdge(edge.id)
  }, [removeEdge])

  if (nodes.length === 0) return (
    <div style={{ height:600,display:'flex',alignItems:'center',justifyContent:'center',background:'#fafafa',border:'1px solid #ddd',borderRadius:8,color:'#999' }}>
      No nodes in this route.
    </div>
  )

  return (
    <div style={{ height:600, border:'1px solid #ddd',borderRadius:8 }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow nodes={flowNodes} edges={flowEdges} onConnect={onConnect} onEdgeClick={onEdgeClick} onNodesChange={onNodesChange} onNodeClick={(_event, node) => selectNode(node.id)} onNodeDragStop={onNodeDragStop} fitView nodesDraggable nodesConnectable edgesFocusable snapToGrid snapGrid={[20, 20]}>
        <Background /><Controls />
      </ReactFlow>
      <div className="workflow-canvas-hint">Drag from node handles to add a connection. Click a connection to delete it. Preview validates before Apply.</div>
    </div>
  )
}
