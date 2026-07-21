/** Node Catalog — list of available nodes (built-in + custom) for drag-to-add. */
import React from 'react'

const BUILT_IN_NODES = [
  { id: 'INTAKE', role: 'dispatcher' },
  { id: 'CONTEXT_PACK', role: 'requirement-analyst' },
  { id: 'REQUIREMENT_REVIEW', role: 'requirement-analyst' },
  { id: 'SOLUTION_DESIGN', role: 'tech-architect' },
  { id: 'PRE_MORTEM', role: 'quality-guardian' },
  { id: 'IMPLEMENTATION_PLAN', role: 'plan-generator' },
  { id: 'DEVELOPMENT', role: 'developer' },
  { id: 'COMPILE', role: 'verifier', locked: true },
  { id: 'UNIT_TEST', role: 'verifier', locked: true },
  { id: 'EVIDENCE_CAPTURE', role: 'verifier', locked: true },
  { id: 'ACCEPTANCE_REPORT', role: 'orchestrator' },
  { id: 'KNOWLEDGE_PROMOTION', role: 'knowledge-keeper' },
]

interface Props {
  onAddNode: (nodeId: string) => void
}

export function NodeCatalog({ onAddNode }: Props): React.ReactElement {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Node Catalog</h4>
      {BUILT_IN_NODES.map((n) => (
        <div
          key={n.id}
          onClick={() => onAddNode(n.id)}
          style={{
            padding: '6px 10px',
            margin: '4px 0',
            background: '#f0f0f0',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            {n.id} <small style={{ color: '#666' }}>({n.role})</small>
          </span>
          {n.locked && <span title="System minimum node — cannot be deleted">🔒</span>}
        </div>
      ))}
    </div>
  )
}
