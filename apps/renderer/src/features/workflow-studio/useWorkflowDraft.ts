/** Zustand store for Workflow Studio draft state with undo/redo. */
import { create } from 'zustand'

interface NodeDraft {
  id: string
  role: string
  artifact: string
  gates: string[]
}

interface EdgeDraft {
  id: string
  source: string
  target: string
}

interface WorkflowDraftState {
  nodes: NodeDraft[]
  edges: EdgeDraft[]
  selectedIntent: string
  selectedRisk: string
  undoStack: NodeDraft[][]
  redoStack: NodeDraft[][]
  diagnostics: Array<{ code: string; severity: string; pointer: string; message: string }>
  selectedNodeId: string
  setNodes: (nodes: NodeDraft[]) => void
  addNode: (node: NodeDraft, index?: number) => void
  removeNode: (nodeId: string) => void
  updateNode: (nodeId: string, patch: Partial<NodeDraft>) => void
  duplicateNode: (nodeId: string) => void
  reorderNode: (fromIndex: number, toIndex: number) => void
  setEdges: (edges: EdgeDraft[]) => void
  addEdge: (source: string, target: string) => void
  removeEdge: (edgeId: string) => void
  setIntent: (intent: string) => void
  setRisk: (risk: string) => void
  setDiagnostics: (diags: WorkflowDraftState['diagnostics']) => void
  selectNode: (nodeId: string) => void
  undo: () => void
  redo: () => void
}

export const useWorkflowDraft = create<WorkflowDraftState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedIntent: 'FEATURE',
  selectedRisk: 'HIGH',
  undoStack: [],
  redoStack: [],
  diagnostics: [],
  selectedNodeId: '',

  setNodes: (nodes) => set({ nodes, edges: buildSequentialEdges(nodes), undoStack: [], redoStack: [], diagnostics: [], selectedNodeId: '' }),
  setEdges: (edges) => set({ edges }),

  addNode: (node, index) => {
    const { nodes } = get()
    if (nodes.some((current) => current.id === node.id)) return
    const before = [...nodes]
    const after = index !== undefined
      ? [...nodes.slice(0, index), node, ...nodes.slice(index)]
      : [...nodes, node]
    set({ nodes: after, edges: buildSequentialEdges(after), undoStack: [...get().undoStack, before], redoStack: [] })
  },

  removeNode: (nodeId) => {
    const { nodes } = get()
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      undoStack: [...get().undoStack, [...nodes]],
      redoStack: [],
    })
  },

  updateNode: (nodeId, patch) => {
    const { nodes } = get()
    const nextId = patch.id?.trim() || nodeId
    if (nextId !== nodeId && nodes.some((node) => node.id === nextId)) return
    set({
      nodes: nodes.map((node) => node.id === nodeId ? { ...node, ...patch, id: nextId } : node),
      edges: get().edges.map((edge) => edge.source === nodeId ? { ...edge, source: nextId } : edge.target === nodeId ? { ...edge, target: nextId } : edge),
      selectedNodeId: nextId,
      undoStack: [...get().undoStack, [...nodes]],
      redoStack: [],
    })
  },

  duplicateNode: (nodeId) => {
    const { nodes } = get()
    const index = nodes.findIndex((node) => node.id === nodeId)
    if (index < 0) return
    let suffix = '_COPY'
    let copyId = `${nodeId}${suffix}`
    let count = 2
    while (nodes.some((node) => node.id === copyId)) copyId = `${nodeId}${suffix}_${count++}`
    const copy = { ...nodes[index], id: copyId, gates: [...nodes[index].gates] }
    const next = [...nodes.slice(0, index + 1), copy, ...nodes.slice(index + 1)]
    set({ nodes: next, edges: buildSequentialEdges(next), selectedNodeId: copyId, undoStack: [...get().undoStack, [...nodes]], redoStack: [] })
  },

  reorderNode: (fromIndex, toIndex) => {
    const { nodes } = get()
    const reordered = [...nodes]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    set({ nodes: reordered, edges: buildSequentialEdges(reordered), undoStack: [...get().undoStack, [...nodes]], redoStack: [] })
  },

  addEdge: (source, target) => {
    const { edges } = get()
    const id = `e-${source}-${target}`
    if (edges.some((edge) => edge.id === id)) return
    set({ edges: [...edges, { id, source, target }] })
  },

  removeEdge: (edgeId) => set({ edges: get().edges.filter((edge) => edge.id !== edgeId) }),

  setIntent: (intent) => set({ selectedIntent: intent }),
  setRisk: (risk) => set({ selectedRisk: risk }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  undo: () => {
    const { undoStack, nodes } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    set({
      nodes: prev,
      edges: buildSequentialEdges(prev),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, [...nodes]],
    })
  },

  redo: () => {
    const { redoStack, nodes } = get()
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    set({
      nodes: next,
      edges: buildSequentialEdges(next),
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, [...nodes]],
    })
  },
}))

function buildSequentialEdges(nodes: NodeDraft[]): EdgeDraft[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `seq-${node.id}-${nodes[index + 1]?.id || 'end'}`,
    source: node.id,
    target: nodes[index + 1].id,
  }))
}
