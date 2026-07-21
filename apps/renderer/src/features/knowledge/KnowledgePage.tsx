import React, { useState } from 'react'

export function KnowledgePage(): React.ReactElement {
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')

  async function load() {
    try {
      const result = await window.harness!.listKnowledge('local', tab)
      if (Array.isArray(result)) setCandidates(result)
    } catch { /* */ }
  }
  React.useEffect(() => { load() }, [tab])

  async function review(id: number, decision: string) {
    try {
      await window.harness!.reviewKnowledge(id, decision)
      load()
    } catch { /* */ }
  }

  const TYPE_LABELS: Record<string, string> = { case: '经验', pitfall: '踩坑', decision: '决策', template: '模板', pattern: '模式' }

  return (
    <div style={{ padding: 24 }}>
      <h2>Knowledge Promotion</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {(['draft', 'accepted', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', cursor: 'pointer', border: 'none', borderRadius: 6,
            background: tab === t ? '#2196f3' : '#e0e0e0', color: tab === t ? '#fff' : '#333'
          }}>{t === 'draft' ? '📝 Pending' : t === 'accepted' ? '✅ Accepted' : '❌ Rejected'}</button>
        ))}
      </div>
      {candidates.map((c: any) => (
        <div key={c.id} style={{ padding: 12, margin: '8px 0', background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{c.title}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, background: '#e3f2fd', padding: '2px 8px', borderRadius: 4 }}>
                {TYPE_LABELS[c.type] || c.type}
              </span>
            </div>
            {tab === 'draft' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => review(c.id, 'accepted')} style={{ padding: '4px 12px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => review(c.id, 'rejected')} style={{ padding: '4px 12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Reject</button>
              </div>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#666', margin: '8px 0 0 0' }}>{c.summary}</p>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Source: {c.source}</div>
        </div>
      ))}
      {candidates.length === 0 && <p style={{ color: '#999' }}>No {tab} knowledge candidates.</p>}
    </div>
  )
}
