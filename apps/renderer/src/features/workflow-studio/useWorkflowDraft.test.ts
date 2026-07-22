import { describe, expect, it, beforeEach } from 'vitest'
import { useWorkflowDraft } from './useWorkflowDraft'

const initialState = useWorkflowDraft.getState()

beforeEach(() => {
  useWorkflowDraft.setState({
    ...initialState,
    nodes: [],
    undoStack: [],
    redoStack: [],
    diagnostics: [],
  }, true)
})

describe('useWorkflowDraft', () => {
  it('adds and reorders nodes', () => {
    useWorkflowDraft.getState().addNode({ id: 'INTAKE', role: 'dispatcher', artifact: '00-intake.md', gates: [] })
    useWorkflowDraft.getState().addNode({ id: 'DEVELOPMENT', role: 'developer', artifact: '11-development.md', gates: [] })

    useWorkflowDraft.getState().reorderNode(1, 0)

    expect(useWorkflowDraft.getState().nodes.map(n => n.id)).toEqual(['DEVELOPMENT', 'INTAKE'])
  })

  it('supports undo and redo', () => {
    useWorkflowDraft.getState().addNode({ id: 'A', role: 'developer', artifact: 'a.md', gates: [] })
    useWorkflowDraft.getState().addNode({ id: 'B', role: 'verifier', artifact: 'b.md', gates: [] })

    useWorkflowDraft.getState().undo()
    expect(useWorkflowDraft.getState().nodes.map(n => n.id)).toEqual(['A'])

    useWorkflowDraft.getState().redo()
    expect(useWorkflowDraft.getState().nodes.map(n => n.id)).toEqual(['A', 'B'])
  })

  it('stores diagnostics for compile feedback', () => {
    useWorkflowDraft.getState().setDiagnostics([
      { code: 'UNKNOWN_GATE', severity: 'error', pointer: '/nodes/0/gates/0', message: '未知 Gate' },
    ])

    expect(useWorkflowDraft.getState().diagnostics[0].code).toBe('UNKNOWN_GATE')
  })
})
