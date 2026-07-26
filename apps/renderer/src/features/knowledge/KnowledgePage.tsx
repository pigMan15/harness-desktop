import React, { useEffect, useRef, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { MarkdownPreview } from '../artifacts/ArtifactsPage'
import { authorizePolicy, loadLocalSettings, policyBlockedMessage, type AiProvider } from '../settings/settings-policy'
import { useLanguage } from '../settings/LanguageContext'

interface KnowledgeLogEntry { type: string; sequence: number; content?: string; error?: unknown; tool?: string; params?: Record<string, unknown>; message?: string; category?: string; requestId?: number; diff?: string; repo?: any; candidateIds?: number[]; manualPushCommand?: string }
const DANGEROUS = new Set(['deploy', 'delete', 'dangerous_git'])
const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g

function cleanLogText(value: string): string {
  return value.replace(ANSI_ESCAPE, '').replace(/\r\n/g, '\n')
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') return cleanLogText(value)
  if (value == null) return ''
  try {
    return cleanLogText(JSON.stringify(value, null, 2))
  } catch {
    return cleanLogText(String(value))
  }
}

function extractLogText(value: unknown, depth = 0): string {
  if (depth > 3 || value == null) return ''
  if (typeof value === 'string') return cleanLogText(value)
  if (Array.isArray(value)) return value.map(item => extractLogText(item, depth + 1)).filter(Boolean).join('\n')
  if (typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  for (const key of ['text', 'content', 'delta', 'message', 'reason', 'output']) {
    const text = extractLogText(record[key], depth + 1)
    if (text) return text
  }
  return extractLogText(record.item, depth + 1)
}

function labelLogItem(type: string): string {
  const labels: Record<string, string> = {
    userMessage: '用户输入',
    reasoning: 'Codex 分析',
    agentMessage: 'Codex 回复',
    commandExecution: '命令执行',
    fileChange: '文件修改',
  }
  return labels[type] || type
}

function KnowledgeContent(): React.ReactElement {
  const { text } = useLanguage()
  const { selectedProjectId } = useWorkspace()
  const [candidates, setCandidates] = useState<any[]>([])
  const [tab, setTab] = useState<'draft' | 'accepted' | 'rejected'>('draft')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [repo, setRepo] = useState<any>({ configured: false })
  const [repoForm, setRepoForm] = useState({ localPath: '', remoteUrl: '', branch: '' })
  const [preview, setPreview] = useState<any>(null)
  const [pushCandidateIds, setPushCandidateIds] = useState<number[]>([])
  const [codexLogs, setCodexLogs] = useState<KnowledgeLogEntry[]>([])
  const [executorCollapsed, setExecutorCollapsed] = useState(true)
  const [codexRunning, setCodexRunning] = useState(false)
  const [codexSessionId, setCodexSessionId] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState<KnowledgeLogEntry[]>([])
  const [confirmDangerous, setConfirmDangerous] = useState(false)
  const [dirtyBlocked, setDirtyBlocked] = useState(false)
  const [codexFeedback, setCodexFeedback] = useState('')
  const [msg, setMsg] = useState('')
  const [msgKind, setMsgKind] = useState<'info' | 'success' | 'error'>('info')
  const [codexAutoFollow, setCodexAutoFollow] = useState(true)
  const [provider, setProvider] = useState<AiProvider>(() => loadLocalSettings().defaultProvider)
  const timer = useRef<ReturnType<typeof setInterval>>()
  const codexLogRef = useRef<HTMLPreElement>(null)
  const pendingApproval = pendingApprovals[0]
  const hasExecutorHistory = Boolean(preview || codexSessionId || codexLogs.length > 0)

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
        if (r.provider === 'claude' || r.provider === 'codex') setProvider(r.provider)
        const id = String(r.sessionId)
        setCodexSessionId(id)
        setCodexRunning(true)
        setExecutorCollapsed(false)
        setPendingApprovals(Array.isArray(r.approvals) ? r.approvals : [])
        showMsg('Resumed active Codex synthesis session.', 'info')
        beginCodexPolling(id)
      }
    }).catch(() => {})
  }, [selectedProjectId])

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  useEffect(() => {
    const log = codexLogRef.current
    if (!log || !codexAutoFollow) return
    const frame = requestAnimationFrame(() => { log.scrollTop = log.scrollHeight })
    return () => cancelAnimationFrame(frame)
  }, [codexAutoFollow, codexLogs, codexSessionId])

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
        setPushCandidateIds(Array.isArray(r.candidateIds) ? r.candidateIds.map(Number) : [...selectedIds])
        setExecutorCollapsed(false)
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
    const settings = loadLocalSettings()
    const providerLabel = provider === 'claude' ? 'Claude Code' : 'Codex'
    const commandAuthorization = authorizePolicy(settings.policy.commandExecution, `Run ${providerLabel} synthesis for ${selectedIds.length} knowledge candidate(s)?`)
    if (!commandAuthorization.allowed) {
      if (commandAuthorization.blocked) showMsg(policyBlockedMessage(`${providerLabel} synthesis`), 'error')
      return
    }
    const repeated = candidates.filter(candidate => selectedIds.includes(Number(candidate.id)) && Number(candidate.push_count || 0) > 0)
    if (repeated.length > 0 && !settings.policy.repeatKnowledgePush) {
      showMsg(`Repeated knowledge push is disabled. Deselect ${repeated.length} previously pushed candidate(s) or change the Policy Engine setting.`, 'error')
      return
    }
    if (allowDirty) {
      const dirtyAuthorization = authorizePolicy(settings.policy.dirtyWorktree, 'Run Codex synthesis while the shared knowledge repository has local changes?')
      if (!dirtyAuthorization.allowed) {
        if (dirtyAuthorization.blocked) showMsg(policyBlockedMessage('Dirty knowledge repository override'), 'error')
        return
      }
    }
    setCodexLogs([])
    setPendingApprovals([])
    setPreview(null)
    setPushCandidateIds([])
    setMsg('')
    setDirtyBlocked(false)
    setCodexRunning(true)
    setExecutorCollapsed(false)
    try {
      const r = await window.harness.startKnowledgeCodexSynthesis(
        selectedProjectId,
        selectedIds,
        allowDirty,
        settings.policy.commandExecution === 'ask',
        allowDirty && settings.policy.dirtyWorktree === 'ask',
        provider,
      )
      if (r?.error || !r?.sessionId) throw new Error(String(r?.error || `${providerLabel} synthesis start failed`))
      const id = String(r.sessionId)
      setCodexSessionId(id)
      showMsg(`${providerLabel} synthesis started for ${r.candidateCount || selectedIds.length} accepted candidate(s).`, 'info')
      beginCodexPolling(id)
    } catch (e: any) {
      setCodexRunning(false)
      setExecutorCollapsed(true)
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
      const approvals = events.filter(entry => entry.type === 'approval_required' && entry.requestId !== undefined)
      if (approvals.length > 0) {
        setPendingApprovals(current => {
          const requestIds = new Set(current.map(entry => entry.requestId))
          return [...current, ...approvals.filter(entry => !requestIds.has(entry.requestId))]
        })
      }
      const previewEvent = events.find(entry => entry.type === 'preview')
      if (previewEvent) {
        setPreview(previewEvent)
        setRepo(previewEvent.repo || repo)
        if (Array.isArray(previewEvent.candidateIds)) setPushCandidateIds(previewEvent.candidateIds.map(Number))
        setExecutorCollapsed(false)
      }
      if (events.some(entry => entry.type === 'exited' || entry.type === 'error')) {
        setCodexRunning(false)
        setPendingApprovals([])
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
      const resolvedRequestId = pendingApproval.requestId
      await window.harness.respondKnowledgeCodexSynthesis(selectedProjectId, codexSessionId, { requestId: resolvedRequestId, decision })
      setPendingApprovals(current => current.filter(entry => entry.requestId !== resolvedRequestId))
      setConfirmDangerous(false)
    } catch (e: any) { showMsg(e.message, 'error') }
  }

  async function cancelCodex() {
    if (!window.harness || !codexSessionId) return
    if (timer.current) clearInterval(timer.current)
    setCodexRunning(false)
    setPendingApprovals([])
    try { await window.harness.cancelKnowledgeCodexSynthesis(selectedProjectId, codexSessionId) }
    catch (e: any) { showMsg(e.message, 'error') }
  }

  async function sendCodexFeedback() {
    const feedback = codexFeedback.trim()
    if (!window.harness || !codexSessionId || !feedback) return
    setCodexRunning(true)
    setPendingApprovals([])
    setMsg('')
    try {
      const r = await window.harness.sendKnowledgeCodexFeedback(selectedProjectId, codexSessionId, feedback)
      if (r?.error) throw new Error(String(r.error))
      setCodexFeedback('')
      showMsg('Feedback sent to Codex. Waiting for updated diff.', 'info')
      beginCodexPolling(codexSessionId)
    } catch (e: any) {
      setCodexRunning(false)
      showMsg(e.message, 'error')
    }
  }

  async function pushRepo() {
    const settings = loadLocalSettings()
    const commitAuthorization = authorizePolicy(settings.policy.gitCommit, `Commit the reviewed shared knowledge changes for ${pushCandidateIds.length} candidate(s)?`)
    if (!commitAuthorization.allowed) {
      if (commitAuthorization.blocked) showMsg(policyBlockedMessage('Knowledge repository commit'), 'error')
      return
    }
    const pushAuthorization = authorizePolicy(settings.policy.gitPush, `Push the shared knowledge repository and mark ${pushCandidateIds.length} candidate(s) as pushed?`)
    if (!pushAuthorization.allowed) {
      if (pushAuthorization.blocked) showMsg(policyBlockedMessage('Knowledge repository push'), 'error')
      return
    }
    const repeated = candidates.filter(candidate => pushCandidateIds.includes(Number(candidate.id)) && Number(candidate.push_count || 0) > 0)
    if (repeated.length > 0 && !settings.policy.repeatKnowledgePush) {
      showMsg(`Repeated knowledge push is disabled for ${repeated.length} candidate(s). Change the Policy Engine setting before pushing again.`, 'error')
      return
    }
    try {
      const candidateIds = [...pushCandidateIds]
      const r = await window.harness!.pushKnowledgeRepo(selectedProjectId, candidateIds, settings.policy.gitPush === 'ask', settings.policy.gitCommit === 'ask')
      if (r?.error) showMsg(r.error, 'error')
      else {
        setRepo(r)
        const refreshed = await window.harness!.listKnowledge(selectedProjectId, tab)
        if (Array.isArray(refreshed)) setCandidates(refreshed)
        const markedCount = Array.isArray(r.pushedCandidateIds) ? r.pushedCandidateIds.length : 0
        setPushCandidateIds([])
        setExecutorCollapsed(true)
        showMsg(`Shared knowledge repository pushed${markedCount > 0 ? `; marked ${markedCount} candidate(s).` : '.'}`, 'success')
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
      const text = cleanLogText(outputBuffer).trim()
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
        const detail = extractLogText(entry.params)
        lines.push(detail ? `${labelLogItem(itemType)}\n${detail}` : labelLogItem(itemType))
      } else if (entry.type === 'approval_required') {
        lines.push(`- Approval required: ${entry.message || entry.category || 'Codex requests approval'}`)
      } else if (entry.type === 'preview') {
        lines.push('- Preview diff is ready.')
      } else if (entry.type === 'exited') {
        lines.push('- Codex synthesis finished.')
      } else if (entry.error) {
        lines.push(`- Error: ${stringifyLogValue(entry.error)}`)
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
    <div className="page knowledge-page">
      <div className="knowledge-hero">
        <div>
          <h2>Knowledge Promotion</h2>
          <p>Review accepted learnings, let a managed AI executor merge them into the shared knowledge base, then preview and publish the Git diff.</p>
        </div>
        <span className="knowledge-hero-count">{selectedIds.length} selected</span>
      </div>
      <div className={`knowledge-workbench ${executorCollapsed ? 'executor-collapsed' : 'executor-expanded'}`}>
        <main className="knowledge-main">
          <section className="knowledge-repo-panel">
            <div>
              <h3>Shared Knowledge Repository</h3>
              <p>Pull a shared Git knowledge base locally, run managed synthesis from accepted records, preview the diff, then push here or push manually.</p>
            </div>
            <div className="knowledge-repo-form">
              <label>Local path<input value={repoForm.localPath} onBlur={() => void inspectLocalPath()} onChange={e => setRepoForm({ ...repoForm, localPath: e.target.value })} placeholder="G:\\Project\\ai\\shared-knowledge" /></label>
              <label>Remote URL<input value={repoForm.remoteUrl} onChange={e => setRepoForm({ ...repoForm, remoteUrl: e.target.value })} placeholder="https://github.com/org/knowledge.git" /></label>
              <label>Branch<input value={repoForm.branch} onChange={e => setRepoForm({ ...repoForm, branch: e.target.value })} placeholder="main" /></label>
            </div>
            <div className="knowledge-repo-actions">
              <div className="segmented-control" aria-label="Knowledge synthesis provider">{(['codex', 'claude'] as AiProvider[]).map((item) => <button key={item} className={provider === item ? 'active' : ''} disabled={codexRunning} onClick={() => setProvider(item)}>{item === 'claude' ? 'Claude Code' : 'Codex'}</button>)}</div>
              <button className="button" onClick={configureRepo}>{text('Save', '保存')}</button>
              <button className="button" onClick={pullRepo} disabled={!repo.configured}>{text('Pull / Clone', '拉取 / 克隆')}</button>
              <button className="button primary" onClick={() => void runCodexSynthesis(false)} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>{text('Run', '运行')} {provider === 'claude' ? 'Claude Code' : 'Codex'} {text('Synthesis', '分析')}</button>
              {dirtyBlocked && <button className="button danger" onClick={() => void runCodexSynthesis(true)} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>{text('Run Anyway', '仍然运行')}</button>}
              <button className="button" onClick={synthesizeRepo} disabled={codexRunning || !repo.configured || selectedIds.length === 0}>{text('Prepare Draft', '准备草稿')}</button>
              <button className="button danger" onClick={cancelCodex} disabled={!codexRunning}>{text('Stop Codex', '停止 Codex')}</button>
              <button className="button success" onClick={pushRepo} disabled={codexRunning || !repo.configured || !repo.dirty}>{text('Push via App', '通过应用推送')}</button>
            </div>
            {repo.configured && <div className="knowledge-repo-status">
              <span className={`knowledge-tag ${repo.isGitRepo ? 'tag-ok' : 'tag-warn'}`}>{repo.isGitRepo ? 'Git Ready' : 'Not a Git repo'}</span>
              {repo.branch && <span className="knowledge-tag tag-run">{repo.branch}</span>}
              {repo.dirty && <span className="knowledge-tag tag-warn">Local changes</span>}
              {repo.lastCommit && <span className="knowledge-tag tag-muted">{repo.lastCommit}</span>}
              {Array.isArray(repo.rules) && repo.rules.map((rule: any) => <span key={rule.path} className="knowledge-tag tag-rule">{rule.path}</span>)}
            </div>}
          </section>
          {executorCollapsed && <section className="knowledge-executor-dock">
            <div>
              <strong>{hasExecutorHistory ? 'Executor collapsed' : 'Codex executor ready'}</strong>
              <span>{hasExecutorHistory ? 'Expand to inspect local diff, Codex logs, and human feedback.' : 'Run Codex or prepare a preview to open the executor rail.'}</span>
            </div>
            {provider === 'claude' && <div className="notice">Claude Code synthesis uses non-interactive acceptEdits mode. Review the local diff before publishing; per-tool Codex approval prompts are not available.</div>}
            {hasExecutorHistory && <button className="button" onClick={() => setExecutorCollapsed(false)}>{text('Open executor', '打开执行器')}</button>}
          </section>}
          <div className="knowledge-tabs">
        {(['draft', 'accepted', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t === 'draft' ? text('Pending', '待审核') : t === 'accepted' ? text('Accepted', '已通过') : text('Rejected', '已拒绝')}</button>
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
                {Number(c.push_count || 0) > 0 && <span className="knowledge-tag tag-ok" title={c.last_pushed_at || undefined}>Pushed{Number(c.push_count) > 1 ? ` x${c.push_count}` : ''}</span>}
              </div>
            </div>
            <span className={`knowledge-status ${c.status}`}>{STATUS_LABELS[c.status] || c.status}</span>
          </div>
          <p className="knowledge-summary">{c.summary}</p>
          <div className="knowledge-actions">
            <button className="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>{expandedId === c.id ? text('Hide Details', '收起详情') : text('View Details', '查看详情')}</button>
            {tab === 'draft' && (
              <>
                <button className="button success" onClick={() => review(c.id, 'accepted')}>{text('Accept', '通过')}</button>
                <button className="button danger" onClick={() => review(c.id, 'rejected')}>{text('Reject', '拒绝')}</button>
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
        {!executorCollapsed && <aside className="knowledge-executor-rail">
          <div className="knowledge-executor-toolbar">
              <div><strong>Executor workbench</strong><span>{codexRunning ? `${provider === 'claude' ? 'Claude Code' : 'Codex'} is running` : 'Preview, logs, and human approval'}</span></div>
            <button className="button" onClick={() => setExecutorCollapsed(true)} disabled={codexRunning || pendingApprovals.length > 0}>{text('Collapse', '收起')}</button>
          </div>
          <section className="knowledge-executor-card">
            <div className="knowledge-executor-head">
              <div>
                <strong>Local preview diff</strong>
                <span>Final file changes that will be written to the shared knowledge repository</span>
              </div>
              {preview?.manualPushCommand && <code>{preview.manualPushCommand}</code>}
            </div>
            {preview?.diff
              ? <pre className="knowledge-diff-pre">{preview.diff}</pre>
              : <div className="knowledge-empty-panel">After Codex finishes, this panel shows the local Git diff for the shared knowledge repository.</div>}
          </section>
          <section className="knowledge-executor-card">
            <div className="knowledge-executor-head">
              <div>
                <strong>{provider === 'claude' ? 'Claude Code' : 'Codex'} synthesis</strong>
                <span>Analysis output, approval requests, and runtime status</span>
              </div>
              {codexSessionId && <code>{codexSessionId}</code>}
            </div>
            {pendingApproval && <div className={`notice ${confirmDangerous ? 'error' : ''}`}>
              <strong>{confirmDangerous ? 'SECOND CONFIRMATION REQUIRED' : `${pendingApproval.category || 'external'} approval - 1/${pendingApprovals.length}`}</strong>
              <div style={{ margin: '6px 0' }}>{pendingApproval.message}</div>
              <div className="actions">
                <button className="button primary" onClick={() => void respondCodex('allow_once')}>{confirmDangerous ? text('Confirm allow', '确认允许') : text('Allow once', '仅允许一次')}</button>
                <button className="button" onClick={() => void respondCodex('allow_session')}>{text('Allow session', '本次会话允许')}</button>
                <button className="button danger" onClick={() => void respondCodex('deny')}>{text('Deny', '拒绝')}</button>
              </div>
            </div>}
            {codexLogs.length > 0 || codexSessionId
              ? <pre ref={codexLogRef} className="knowledge-codex-pre" onScroll={(event) => { const target = event.currentTarget; setCodexAutoFollow(target.scrollTop + target.clientHeight >= target.scrollHeight - 8) }}>{codexLogs.length === 0 ? 'Waiting for Codex events...' : formatCodexLogs(codexLogs)}</pre>
              : <div className="knowledge-empty-panel">Codex runtime status, analysis output, and approval requests appear here.</div>}
            {codexSessionId && <div className="knowledge-log-controls">
              <span className={`badge ${codexAutoFollow ? 'success' : 'warning'}`}>{codexAutoFollow ? 'Following output' : 'Scroll paused'}</span>
              <button className="button" onClick={() => { setCodexAutoFollow(true); requestAnimationFrame(() => { if (codexLogRef.current) codexLogRef.current.scrollTop = codexLogRef.current.scrollHeight }) }}>{text('Follow', '跟随')}</button>
            </div>}
            {codexSessionId && <div className="knowledge-feedback-box">
              <label>Human approval / revision feedback</label>
              <textarea value={codexFeedback} onChange={e => setCodexFeedback(e.target.value)} placeholder="Example: merge this into retrieval-playbook.md, keep the current section structure, and do not create an inbox draft." />
              <div className="knowledge-feedback-actions">
                <button className="button primary" onClick={() => void sendCodexFeedback()} disabled={codexRunning || !codexFeedback.trim()}>{text('Send feedback', '发送反馈')}</button>
                <span>Accept the result with Push via App, or request another Codex revision here.</span>
              </div>
            </div>}
          </section>
        </aside>}
      </div>
    </div>
  )
}

export function KnowledgePage(): React.ReactElement { return <ProjectRequired><KnowledgeContent /></ProjectRequired> }
