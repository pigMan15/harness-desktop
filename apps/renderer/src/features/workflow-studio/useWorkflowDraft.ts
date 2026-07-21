/** Zustand store for Workflow Studio draft state with undo/redo. */
import { create } from 'zustand'

interface NodeDraft {
  id: string
  role: string
  artifact: string
  gates: string[]
}

interface WorkflowDraftState {
  nodes: NodeDraft[]
  selectedIntent: string
  selectedRisk: string
  undoStack: NodeDraft[][]
  redoStack: NodeDraft[][]
  diagnostics: Array<{ code: string; severity: string; pointer: string; message: string }>
  setNodes: (nodes: NodeDraft[]) => void
  addNode: (node: NodeDraft, index?: number) => void
  removeNode: (nodeId: string) => void
  reorderNode: (fromIndex: number, toIndex: number) => void
  setIntent: (intent: string) => void
  setRisk: (risk: string) => void
  setDiagnostics: (diags: WorkflowDraftState['diagnostics']) => void
  undo: () => void
  redo: () => void
}

export const useWorkflowDraft = create<WorkflowDraftState>((set, get) => ({
  nodes: [],
  selectedIntent: 'FEATURE',
  selectedRisk: 'HIGH',
  undoStack: [],
  redoStack: [],
  diagnostics: [],

  setNodes: (nodes) => set({ nodes }),

  addNode: (node, index) => {
    const { nodes } = get()
    const before = [...nodes]
    const after = index !== undefined
      ? [...nodes.slice(0, index), node, ...nodes.slice(index)]
      : [...nodes, node]
    set({ nodes: after, undoStack: [...get().undoStack, before], redoStack: [] })
  },

  removeNode: (nodeId) => {
    const { nodes } = get()
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      undoStack: [...get().undoStack, [...nodes]],
      redoStack: [],
    })
  },

  reorderNode: (fromIndex, toIndex) => {
    const { nodes } = get()
    const reordered = [...nodes]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    set({ nodes: reordered, undoStack: [...get().undoStack, [...nodes]], redoStack: [] })
  },

  setIntent: (intent) => set({ selectedIntent: intent }),
  setRisk: (risk) => set({ selectedRisk: risk }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),

  undo: () => {
    const { undoStack, nodes } = get()
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    set({
      nodes: prev,
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
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, [...nodes]],
    })
  },
}))
