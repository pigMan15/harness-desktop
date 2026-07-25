import React, { useEffect, useRef, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { MarkdownPreview } from '../artifacts/ArtifactsPage'

interface KnowledgeLogEntry { type: string; sequence: number; content?: string; error?: string; tool?: string; params?: Record<string, unknown>; message?: string; category?: string; requestId?: number; diff?: string; repo?: any; manualPushCommand?: string }
const DANGEROUS = new Set(['deploy', 'delete', 'dangerous_git'])

function KnowledgeContent(): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [repo, setRepo] = useState<any>({ configured: false })
  const [repoForm, setRepoForm] = useState({ localPath: '', remoteUrl: '', branch: '' })
  const [preview, setPreview] = useState<any>(null)
  const [codexLogs, setCodexLogs] = useState<KnowledgeLogEntry[]>([])
  const [codexRunning, setCodexRunning] = useState(false)
  const [codexSessionId, setCodexSessionId] = useState('')
  const [pendingApproval, setPendingApproval] = useState<KnowledgeLogEntry>()
  const [confirmDangerous, setConfirmDangerous] = useState(false)
  const [dirtyBlocked, setDirtyBlocked] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgKind, setMsgKind] = useState<'info' | 'success' | 'error'>('info')
  const timer = useRef<ReturnType<typeof setInterval>>()

  function showMsg(message: string, kind: 'info' | 'success' | 'error' = 'info') {
    setMsg(message)
    setMsgKind(kind)
  }

  useEffect(() => {
    setMsg('')
    window.harness?.listKnowledge(selectedProjectId, tab).then(r => {
      if (Array.isArray(r)) setCandidates(r)
      else if (r?.error) showMsg(r.error, 'error')
    }).catch((e: any) => showMsg(e.message, 'error'))
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

  useEffect(() => {
    window.harness?.getActiveKnowledgeCodexSynthesis(selectedProjectId).then(r => {
      if (r?.active && r.sessionId) {
        const id = String(r.sessionId)
        setCodexSessionId(id)
        setCodexRunning(true)
        showMsg('Resumed active Codex synthesis session.', 'info')
        beginCodexPolling(id)
      }
    }).catch(() => {})
  }, [selectedProjectId])

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  async function review(id: number, decision: string) {
    try {
      const r = await window.harness!.reviewKnowledge(selectedProjectId, id, decision)
      if (r && !r.error) {
        setCandidates(prev => prev.filter(c => c.id !== id))
        showMsg(`Candidate ${id} ${decision}`, 'success')
      } else showMsg(r?.error || 'Failed', 'error')
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  async function configureRepo() {
    try {
      const r = await window.harness!.configureKnowledgeRepo(selectedProjectId, repoForm.localPath, repoForm.remoteUrl, repoForm.branch)
      if (r?.error) showMsg(r.error, 'error')
      else {
        setRepo(r)
        showMsg('Shared knowledge repository configured.', 'success')
      }
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  async function inspectLocalPath() {
    const localPath = repoForm.localPath.trim()
    if (!window.harness || !localPath) return
    try {
      const r = await window.harness.inspectKnowledgeRepoLocalPath(selectedProjectId, localPath)
      if (r?.error) return
      setRepoForm(current => ({
        ...current,
        localPath: typeof r.localPath === 'string' ? r.localPath : current.localPath,
        remoteUrl: typeof r.remoteUrl === 'string' && r.remoteUrl ? r.remoteUrl : current.remoteUrl,
        branch: typeof r.branch === 'string' && r.branch ? r.branch : current.branch,
      }))
      if (r?.isGitRepo) showMsg('Detected local Git repository and filled remote settings.', 'success')
    } catch (_e: any) {}
  }

  async function pullRepo() {
    try {
      const r = await window.harness!.pullKnowledgeRepo(selectedProjectId)
      if (r?.error) showMsg(r.error, 'error')
      else {
        setRepo(r)
        showMsg('Shared knowledge repository is up to date.', 'success')
      }
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  async function synthesizeRepo() {
    try {
      const r = await window.harness!.synthesizeKnowledgeRepo(selectedProjectId, selectedIds)
      if (r?.error) showMsg(r.error, 'error')
      else {
        setPreview(r)
        setRepo(r.repo || repo)
        showMsg(`Generated local preview for ${selectedIds.length} accepted candidate(s).`, 'success')
      }
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  function beginCodexPolling(sessionId: string) {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => { void pollCodex(sessionId) }, 700)
  }

  async function runCodexSynthesis(allowDirty = false) {
    if (!window.harness) return
    setCodexLogs([])
    setPendingApproval(undefined)
    setPreview(null)
    setMsg('')
    setDirtyBlocked(false)
    setCodexRunning(true)
    try {
      const r = await window.harness.startKnowledgeCodexSynthesis(selectedProjectId, selectedIds, allowDirty)
      if (r?.error || !r?.sessionId) throw new Error(String(r?.error || 'Codex synthesis start failed'))
      const id = String(r.sessionId)
      setCodexSessionId(id)
      showMsg(`Codex synthesis started for ${r.candidateCount || selectedIds.length} accepted candidate(s).`, 'info')
      beginCodexPolling(id)
    } catch (e: any) {
      setCodexRunning(false)
      if (String(e.message || '').includes('KNOWLEDGE_REPO_DIRTY')) setDirtyBlocked(true)
      showMsg(e.message, 'error')
    }
  }

  async function pollCodex(sessionId: string) {
    if (!window.harness) return
    try {
      const result = await window.harness.pollKnowledgeCodexSynthesis(selectedProjectId, sessionId)
      if (!Array.isArray(result) || result.length === 0) return
      const events = result as KnowledgeLogEntry[]
      setCodexLogs(current => {
        const keys = new Set(current.map(entry => `${entry.type}:${entry.sequence}`))
        return [...current, ...events.filter(entry => !keys.has(`${entry.type}:${entry.sequence}`))]
      })
      const approval = events.find(entry => entry.type === 'approval_required')
      if (approval) setPendingApproval(approval)
      const previewEvent = events.find(entry => entry.type === 'preview')
      if (previewEvent) {
        setPreview(previewEvent)
        setRepo(previewEvent.repo || repo)
      }
      if (events.some(entry => entry.type === 'exited' || entry.type === 'error')) {
        setCodexRunning(false)
        if (timer.current) clearInterval(timer.current)
      }
    } catch (e: any) {
      setCodexRunning(false)
      showMsg(e.message, 'error')
      if (timer.current) clearInterval(timer.current)
    }
  }

  async function respondCodex(decision: 'allow_once' | 'allow_session' | 'deny' | 'cancel') {
    if (!window.harness || !codexSessionId || pendingApproval?.requestId === undefined) return
    if (decision === 'allow_once' && DANGEROUS.has(pendingApproval.category || '') && !confirmDangerous) {
      setConfirmDangerous(true)
      return
    }
    try {
      await window.harness.respondKnowledgeCodexSynthesis(selectedProjectId, codexSessionId, { requestId: pendingApproval.requestId, decision })
      setPendingApproval(undefined)
      setConfirmDangerous(false)
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  async function cancelCodex() {
    if (!window.harness || !codexSessionId) return
    if (timer.current) clearInterval(timer.current)
    setCodexRunning(false)
    try { await window.harness.cancelKnowledgeCodexSynthesis(selectedProjectId, codexSessionId) }
    catch (e: any) { showMsg(e.message, 'error') }
  }

  async function pushRepo() {
    try {
      const r = await window.harness!.pushKnowledgeRepo(selectedProjectId)
      if (r?.error) showMsg(r.error, 'error')
      else {
        setRepo(r)
        showMsg('Shared knowledge repository pushed.', 'success')
      }
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  function toggleCandidate(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  function formatCodexLogs(entries: KnowledgeLogEntry[]): string {
    const lines: string[] = []
    let outputBuffer = ''
    function flushOutput() {
      const text = outputBuffer.trim()
      if (text) lines.push(text)
      outputBuffer = ''
    }
    for (const entry of entries) {
      if (entry.type === 'output') {
        outputBuffer += entry.content || ''
        continue
      }
      flushOutput()
      if (entry.type === 'tool_call') {
        const itemType = typeof entry.params?.type === 'string' ? entry.params.type : entry.tool || 'tool'
        lines.push(`- ${itemType}`)
      } else if (entry.type === 'approval_required') {
        lines.push(`- Approval required: ${entry.message || entry.category || 'Codex requests approval'}`)
      } else if (entry.type === 'preview') {
        lines.push('- Preview diff is ready.')
      } else if (entry.type === 'exited') {
        lines.push('- Codex synthesis finished.')
      } else if (entry.error) {
        lines.push(`- Error: ${entry.error}`)
      } else if (entry.message) {
        lines.push(`- ${entry.message}`)
      }
    }
    flushOutput()
    return lines.join('\n\n')
  }

  const TYPE_LABELS: Record<string, string> = { case: 'Case', pitfall: 'Pitfall', decision: 'Decision', template: 'Template', pattern: 'Pattern' }
  const STATUS_LABELS: Record<string, string> = { draft: 'Pending', accepted: 'Accepted', rejected: 'Rejected' }

  return (
    <div className="knowledge-page">
      <div className="knowledge-hero">
        <div>
          <h2>Knowledge Promotion</h2>
          <p>Review accepted learnings, let Codex merge them into the shared knowledge base, then preview and publish the Git diff.</p>
        </div>
        <span className="knowledge-hero-count">{selectedIds.length} selected</span>
      </div>
      <div className="knowledge-workbench">
        <main className="knowledge-main">
          <section className="knowledge-repo-panel">
            <div>
              <h3>Shared Knowledge Repository</h3>
              <p>Pull a shared Git knowledge base locally, run Codex synthesis from accepted records, preview the diff, then push here or push manually.</p>
            </div>
            <div className="knowledge-repo-form">
              <label>Local path<input value={repoForm.localPath} onBlur={() => void inspectLocalPath()} onChange={e => setRepoForm({ ...repoForm, localPath: e.target.value })} placeholder="G:\\Project\\ai\\shared-knowledge" /></label>
              <label>Remote URL<input value={repoForm.remoteUrl} onChange={e => setRepoForm({ ...repoForm, remoteUrl: e.target.value })} placeholder="https://github.com/org/knowledge.git" /></label>
              <label>Branch<input value={repoForm.branch} onChange={e => setRepoForm({ ...repoForm, branch: e.target.value })} placeholder="main" /></label>
            </div>
            <div className="knowledge-repo-actions">
              <button className="button" onClick={configureRepo}>Save</button>
              <button className="button" onClick={pullRepo} disabled={!repo.configured}>Pull / Clone</button>
              <button className="button primary" onClick={() => void runCodexSynthesis(false)} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>Run Codex Synthesis</button>
              {dirtyBlocked && <button className="button danger" onClick={() => void runCodexSynthesis(true)} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>Run Anyway</button>}
              <button className="button" onClick={synthesizeRepo} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>Prepare Draft</button>
              <button className="button danger" onClick={cancelCodex} disabled={!codexRunning}>Stop Codex</button>
              <button className="button success" onClick={pushRepo} disabled={!repo.configured || !repo.dirty}>Push via App</button>
            </div>
            {repo.configured && <div className="knowledge-repo-status">
              <span className={`knowledge-tag ${repo.isGitRepo ? 'tag-ok' : 'tag-warn'}`}>{repo.isGitRepo ? 'Git Ready' : 'Not a Git repo'}</span>
              {repo.branch && <span className="knowledge-tag tag-run">{repo.branch}</span>}
              {repo.dirty && <span className="knowledge-tag tag-warn">Local changes</span>}
              {repo.lastCommit && <span className="knowledge-tag tag-muted">{repo.lastCommit}</span>}
              {Array.isArray(repo.rules) && repo.rules.map((rule: any) => <span key={rule.path} className="knowledge-tag tag-rule">{rule.path}</span>)}
            </div>}
          </section>
          <div className="knowledge-tabs">
        {(['draft', 'accepted', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t === 'draft' ? 'Pending' : t === 'accepted' ? 'Accepted' : 'Rejected'}</button>
        ))}
      </div>
      {msg && <p className={`knowledge-message ${msgKind}`}>{msg}</p>}
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
        </main>
        <aside className="knowledge-executor-rail">
          <section className="knowledge-executor-card">
            <div className="knowledge-executor-head">
              <div>
                <strong>Local preview diff</strong>
                <span>最终写入共享知识库的文件差异</span>
              </div>
              {preview?.manualPushCommand && <code>{preview.manualPushCommand}</code>}
            </div>
            {preview?.diff
              ? <pre className="knowledge-diff-pre">{preview.diff}</pre>
              : <div className="knowledge-empty-panel">Codex 完成后，这里展示共享知识库本地仓库的 Git diff。</div>}
          </section>
          <section className="knowledge-executor-card">
            <div className="knowledge-executor-head">
              <div>
                <strong>Codex synthesis</strong>
                <span>Codex 分析、审批和运行状态</span>
              </div>
              {codexSessionId && <code>{codexSessionId}</code>}
            </div>
            {pendingApproval && <div className={`notice ${confirmDangerous ? 'error' : ''}`}>
              <strong>{confirmDangerous ? 'SECOND CONFIRMATION REQUIRED' : `${pendingApproval.category || 'external'} approval`}</strong>
              <div style={{ margin: '6px 0' }}>{pendingApproval.message}</div>
              <div className="actions">
                <button className="button primary" onClick={() => void respondCodex('allow_once')}>{confirmDangerous ? 'Confirm allow' : 'Allow once'}</button>
                <button className="button" onClick={() => void respondCodex('allow_session')}>Allow session</button>
                <button className="button danger" onClick={() => void respondCodex('deny')}>Deny</button>
              </div>
            </div>}
            {codexLogs.length > 0 || codexSessionId
              ? <pre className="knowledge-codex-pre">{codexLogs.length === 0 ? 'Waiting for Codex events...' : formatCodexLogs(codexLogs)}</pre>
              : <div className="knowledge-empty-panel">这里展示 Codex 的运行状态、分析输出和审批请求。</div>}
          </section>
        </aside>
      </div>
    </div>
  )
}

export function KnowledgePage(): React.ReactElement { return <ProjectRequired><KnowledgeContent /></ProjectRequired> }
