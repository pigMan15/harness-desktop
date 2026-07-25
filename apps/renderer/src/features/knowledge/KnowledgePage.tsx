import React, { useEffect, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { MarkdownPreview } from '../artifacts/ArtifactsPage'

function KnowledgeContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [repo, setRepo] = useState<any>({ configured: false })
  const [repoForm, setRepoForm] = useState({ localPath: '', remoteUrl: '', branch: '' })
  const [preview, setPreview] = useState<any>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setMsg('')
    window.harness?.listKnowledge(selectedProjectId, tab).then(r => {
      if (Array.isArray(r)) setCandidates(r)
      else if (r?.error) setMsg(r.error)
    }).catch((e: any) => setMsg(e.message))
  }, [selectedProjectId, tab])

  useEffect(() => {
    window.harness?.getKnowledgeRepoStatus(selectedProjectId).then(r => {
      if (r && !r.error) {
        setRepo(r)
        setRepoForm({
          localPath: typeof r.localPath === 'string' ? r.localPath : '',
          remoteUrl: typeof r.remoteUrl === 'string' ? r.remoteUrl : '',
          branch: typeof r.branch === 'string' ? r.branch : '',
        })
      }
    }).catch(() => {})
  }, [selectedProjectId])

  async function review(id: number, decision: string) {
    try {
      const r = await window.harness!.reviewKnowledge(selectedProjectId, id, decision)
      if (r && !r.error) {
        setCandidates(prev => prev.filter(c => c.id !== id))
        setMsg(`Candidate ${id} ${decision}`)
      } else setMsg(r?.error || 'Failed')
    } catch (e: any) { setMsg(e.message) }
  }

  async function configureRepo() {
    try {
      const r = await window.harness!.configureKnowledgeRepo(selectedProjectId, repoForm.localPath, repoForm.remoteUrl, repoForm.branch)
      if (r?.error) setMsg(r.error)
      else {
        setRepo(r)
        setMsg('Shared knowledge repository configured.')
      }
    } catch (e: any) { setMsg(e.message) }
  }

  async function pullRepo() {
    try {
      const r = await window.harness!.pullKnowledgeRepo(selectedProjectId)
      if (r?.error) setMsg(r.error)
      else {
        setRepo(r)
        setMsg('Shared knowledge repository is up to date.')
      }
    } catch (e: any) { setMsg(e.message) }
  }

  async function synthesizeRepo() {
    try {
      const r = await window.harness!.synthesizeKnowledgeRepo(selectedProjectId, selectedIds)
      if (r?.error) setMsg(r.error)
      else {
        setPreview(r)
        setRepo(r.repo || repo)
        setMsg(`Generated local preview for ${selectedIds.length} accepted candidate(s).`)
      }
    } catch (e: any) { setMsg(e.message) }
  }

  async function pushRepo() {
    try {
      const r = await window.harness!.pushKnowledgeRepo(selectedProjectId)
      if (r?.error) setMsg(r.error)
      else {
        setRepo(r)
        setMsg('Shared knowledge repository pushed.')
      }
    } catch (e: any) { setMsg(e.message) }
  }

  function toggleCandidate(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const TYPE_LABELS: Record<string, string> = { case: 'Case', pitfall: 'Pitfall', decision: 'Decision', template: 'Template', pattern: 'Pattern' }
  const STATUS_LABELS: Record<string, string> = { draft: 'Pending', accepted: 'Accepted', rejected: 'Rejected' }

  return (
    <div className="knowledge-page">
      <h2>Knowledge Promotion</h2>
      <section className="knowledge-repo-panel">
        <div>
          <h3>Shared Knowledge Repository</h3>
          <p>Pull a shared Git knowledge base locally, generate a Codex-ready update draft from accepted records, preview the diff, then push here or push manually.</p>
        </div>
        <div className="knowledge-repo-form">
          <label>Local path<input value={repoForm.localPath} onChange={e => setRepoForm({ ...repoForm, localPath: e.target.value })} placeholder="G:\\Project\\ai\\shared-knowledge" /></label>
          <label>Remote URL<input value={repoForm.remoteUrl} onChange={e => setRepoForm({ ...repoForm, remoteUrl: e.target.value })} placeholder="https://github.com/org/knowledge.git" /></label>
          <label>Branch<input value={repoForm.branch} onChange={e => setRepoForm({ ...repoForm, branch: e.target.value })} placeholder="main" /></label>
        </div>
        <div className="knowledge-repo-actions">
          <button className="button" onClick={configureRepo}>Save</button>
          <button className="button" onClick={pullRepo} disabled={!repo.configured}>Pull / Clone</button>
          <button className="button primary" onClick={synthesizeRepo} disabled={!repo.configured || selectedIds.length === 0}>Generate Preview</button>
          <button className="button success" onClick={pushRepo} disabled={!repo.configured || !repo.dirty}>Push via App</button>
        </div>
        {repo.configured && <div className="knowledge-repo-status">
          <span className={`knowledge-tag ${repo.isGitRepo ? 'tag-ok' : 'tag-warn'}`}>{repo.isGitRepo ? 'Git Ready' : 'Not a Git repo'}</span>
          {repo.branch && <span className="knowledge-tag tag-run">{repo.branch}</span>}
          {repo.dirty && <span className="knowledge-tag tag-warn">Local changes</span>}
          {repo.lastCommit && <span className="knowledge-tag tag-muted">{repo.lastCommit}</span>}
          {Array.isArray(repo.rules) && repo.rules.map((rule: any) => <span key={rule.path} className="knowledge-tag tag-rule">{rule.path}</span>)}
        </div>}
        {preview?.diff && <div className="knowledge-preview">
          <div className="knowledge-preview-head">
            <strong>Local preview diff</strong>
            {preview.manualPushCommand && <code>{preview.manualPushCommand}</code>}
          </div>
          <pre>{preview.diff}</pre>
        </div>}
      </section>
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
            {tab === 'accepted' && <input className="knowledge-select" type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleCandidate(c.id)} aria-label={`Select ${c.title}`} />}
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
