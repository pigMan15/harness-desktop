import React, { useEffect, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { MarkdownPreview } from '../artifacts/ArtifactsPage'

function KnowledgeContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')
  const [expandedId, setExpandedId] = useState<number | null>(null)
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
  const STATUS_LABELS: Record<string, string> = { draft: 'Pending', accepted: 'Accepted', rejected: 'Rejected' }

  return (
    <div className="knowledge-page">
      <h2>Knowledge Promotion</h2>
      <div className="knowledge-tabs">
        {(['draft', 'accepted', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t === 'draft' ? 'Pending' : t === 'accepted' ? 'Accepted' : 'Rejected'}</button>
        ))}
      </div>
      {msg && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{msg}</p>}
      {candidates.length === 0 && !msg && <p style={{ color: '#999' }}>No {tab} knowledge candidates.</p>}
      <div className="knowledge-grid">
      {candidates.map((c: any) => (
        <article key={c.id} className="knowledge-card">
          <div className="knowledge-card-header">
            <div className="knowledge-title-group">
              <h3>{c.title}</h3>
              <div className="knowledge-keywords">
                <span className="knowledge-tag tag-type">{TYPE_LABELS[c.type] || c.type}</span>
                {c.run_id && <span className="knowledge-tag tag-run">Run {c.run_id}</span>}
              </div>
            </div>
            <span className={`knowledge-status ${c.status}`}>{STATUS_LABELS[c.status] || c.status}</span>
          </div>
          <p className="knowledge-summary">{c.summary}</p>
          <div className="knowledge-actions">
            <button className="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>{expandedId === c.id ? 'Hide Details' : 'View Details'}</button>
            {tab === 'draft' && (
              <>
                <button className="button success" onClick={() => review(c.id, 'accepted')}>Accept</button>
                <button className="button danger" onClick={() => review(c.id, 'rejected')}>Reject</button>
              </>
            )}
          </div>
          {expandedId === c.id && <div className="knowledge-details">
            <div className="knowledge-source">Source: <span className="mono">{c.source}</span></div>
            {typeof c.content === 'string'
              ? <MarkdownPreview content={c.content} />
              : <pre style={{ maxHeight: 420, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>{JSON.stringify(c, null, 2)}</pre>}
          </div>}
        </article>
      ))}
      </div>
    </div>
  )
}

export function KnowledgePage(): React.ReactElement { return <ProjectRequired><KnowledgeContent /></ProjectRequired> }
