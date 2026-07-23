import React, { useEffect, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

function KnowledgeContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setMsg('')
    window.harness?.listKnowledge(selectedProjectId, tab).then(r => {
      if (Array.isArray(r)) setCandidates(r)
      else if (r?.error) setMsg(r.error)
    }).catch((e: any) => setMsg(e.message))
  }, [selectedProjectId, tab])

  async function review(id: number, decision: string) {
    try {
      const r = await window.harness!.reviewKnowledge(selectedProjectId, id, decision)
      if (r && !r.error) {
        setCandidates(prev => prev.filter(c => c.id !== id))
        setMsg(`Candidate ${id} ${decision}`)
      } else setMsg(r?.error || 'Failed')
    } catch (e: any) { setMsg(e.message) }
  }

  const TYPE_LABELS: Record<string, string> = { case: 'Case', pitfall: 'Pitfall', decision: 'Decision', template: 'Template', pattern: 'Pattern' }

  return (
    <div style={{ padding: 24 }}>
      <h2>Knowledge Promotion</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {(['draft', 'accepted', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', cursor: 'pointer', border: 'none', borderRadius: 6,
            background: tab === t ? '#2196f3' : '#e0e0e0', color: tab === t ? '#fff' : '#333'
          }}>{t === 'draft' ? 'Pending' : t === 'accepted' ? 'Accepted' : 'Rejected'}</button>
        ))}
      </div>
      {msg && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{msg}</p>}
      {candidates.length === 0 && !msg && <p style={{ color: '#999' }}>No {tab} knowledge candidates.</p>}
      {candidates.map((c: any) => (
        <div key={c.id} style={{ padding: 12, margin: '8px 0', background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{c.title}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, background: '#e3f2fd', padding: '2px 8px', borderRadius: 4 }}>{TYPE_LABELS[c.type] || c.type}</span>
            </div>
            {tab === 'draft' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => review(c.id, 'accepted')} style={{ padding: '4px 12px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => review(c.id, 'rejected')} style={{ padding: '4px 12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Reject</button>
              </div>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#666', margin: '8px 0 0 0' }}>{c.summary}</p>
        </div>
      ))}
    </div>
  )
}

export function KnowledgePage(): React.ReactElement { return <ProjectRequired><KnowledgeContent /></ProjectRequired> }
