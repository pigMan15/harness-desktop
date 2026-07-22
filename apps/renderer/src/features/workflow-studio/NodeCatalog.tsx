/** Node Catalog — draggable built-in nodes for the Workflow Canvas. */
import React from 'react'

const BUILT_IN = [
  { id:'INTAKE',role:'dispatcher' },{ id:'CONTEXT_PACK',role:'requirement-analyst' },
  { id:'REQUIREMENT_REVIEW',role:'requirement-analyst' },{ id:'REQUIREMENT_CONFIRMATION',role:'orchestrator',locked:true },
  { id:'SOLUTION_DESIGN',role:'tech-architect' },{ id:'SOLUTION_CONFIRMATION',role:'orchestrator',locked:true },
  { id:'PRE_MORTEM',role:'quality-guardian',locked:true },{ id:'IMPLEMENTATION_PLAN',role:'plan-generator' },
  { id:'ACCEPTANCE_CONFIRMATION',role:'orchestrator',locked:true },{ id:'CHANGE_REQUEST',role:'state-keeper' },
  { id:'BRANCH_CREATION',role:'state-keeper' },{ id:'WORKTREE_CREATION',role:'state-keeper' },
  { id:'CODING_DESIGN_CONFIRMATION',role:'developer' },{ id:'DEVELOPMENT',role:'developer' },
  { id:'COMPILE',role:'verifier',locked:true },{ id:'UNIT_TEST',role:'verifier',locked:true },
  { id:'ATDD',role:'verifier' },{ id:'EVIDENCE_CAPTURE',role:'verifier',locked:true },
  { id:'PRERELEASE_DEPLOYMENT',role:'deployer',locked:true },{ id:'INTERFACE_TEST',role:'tester',locked:true },
  { id:'ACCEPTANCE_REPORT',role:'orchestrator' },{ id:'KNOWLEDGE_PROMOTION',role:'knowledge-keeper' },
]

interface Props { onAddNode: (nodeId: string) => void }

function onDragStart(e: React.DragEvent, nodeId: string) {
  e.dataTransfer.setData('application/reactflow', nodeId)
  e.dataTransfer.effectAllowed = 'move'
}

export function NodeCatalog({ onAddNode }: Props): React.ReactElement {
  return (
    <div style={{ border:'1px solid #ddd',borderRadius:4,padding:8,background:'#fff' }}>
      <h4 style={{ margin:'0 0 8px 0',fontSize:14 }}>Node Catalog</h4>
      <p style={{ fontSize:11,color:'#999',margin:'0 0 8px 0' }}>Drag onto canvas or click to add</p>
      {BUILT_IN.map(n => (
        <div key={n.id}
          draggable
          onDragStart={e => onDragStart(e, n.id)}
          onClick={() => onAddNode(n.id)}
          style={{ padding:'6px 8px',margin:'3px 0',background: n.locked ? '#fff3cd' : '#f0f0f0',borderRadius:4,cursor:'grab',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12 }}
        >
          <span><strong>{n.id}</strong> <span style={{color:'#666'}}>({n.role})</span></span>
          {n.locked && <span title="System minimum node">🔒</span>}
        </div>
      ))}
    </div>
  )
}
