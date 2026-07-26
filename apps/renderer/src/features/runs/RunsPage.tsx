import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Archive, CheckCircle2, Clipboard, FileDiff, GitCommit, GitMerge, Pause, Play, RefreshCw, SquareTerminal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { RunSummary } from '../../app/harness-api'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { authorizePolicy, loadLocalSettings, policyBlockedMessage } from '../settings/settings-policy'
import { useLanguage } from '../settings/LanguageContext'
import { canExecuteMerge, mergeIssueGuidance, type MergeIssue, type MergePreflight } from './merge-assistant'
import './runs.css'

const INTENTS = ['QUERY', 'BUG_FIX', 'FEATURE', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

function explainRunError(message: string): string {
  if (message.includes('TARGET_WORKTREE_DIRTY')) return '主项目有尚未保存为版本的修改，请先保存为版本或临时保存，然后重新检查。'
  if (message.includes('RUN_WORKTREE_DIRTY')) return '任务工作目录有尚未保存为版本的修改，请先检查并保存为版本。'
  if (message.includes('REVISION_CONFLICT')) return '页面信息已过期，请重新检查后再操作。'
  return message
}

function mergeStatus(run: RunSummary): { label: string; className: string; title: string } {
  if (run.merged_back) return { label: '已合并', className: 'success', title: run.merged_commit ? `合并版本 ${run.merged_commit}` : '任务代码已合并到主项目' }
  if (run.branch_name && run.worktree_path) return { label: '可检查合并', className: 'warning', title: '任务代码已准备好，可以检查是否能安全合并。' }
  return { label: '无任务目录', className: '', title: '此任务没有可用于合并的独立工作目录。' }
}

function runFromState(state: Record<string, unknown>): RunSummary {
  return {
    run_id: String(state.run_id || ''), intent: String(state.intent || ''), risk: String(state.risk || ''),
    status: String(state.status || ''), current_node: String(state.current_node || ''), next_role: String(state.next_role || ''),
    completed_nodes: (state.completed_nodes as string[]) || [], required_nodes: (state.required_nodes as string[]) || [],
    blocked_by: (state.blocked_by as string[]) || [], phase_dir: String(state.phase_dir || ''), active: true,
    revision: String(state.revision || ''), branch_name: state.branch_name ? String(state.branch_name) : undefined,
    worktree_path: state.worktree_path ? String(state.worktree_path) : undefined,
    merged_back: Boolean(state.merged_back),
    merged_target_branch: state.merged_target_branch ? String(state.merged_target_branch) : undefined,
    merged_commit: state.merged_commit ? String(state.merged_commit) : undefined,
    merged_at: state.merged_at ? String(state.merged_at) : undefined,
  }
}

function issueCopy(issue: MergeIssue): { title: string; description: string; action: string } {
  const known = mergeIssueGuidance(issue.code)
  if (known.title !== '无法完成合并预检') return known
  return { title: issue.title || known.title, description: issue.description || known.description, action: issue.action || known.action }
}

function TasksContent(): React.ReactElement {
  const { text } = useLanguage()
  const { selectedProjectId, selectedRunId, revision, terminalSessionsById, selectRun, updateActiveRun, refreshTerminals } = useWorkspace()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [intent, setIntent] = useState('FEATURE')
  const [risk, setRisk] = useState('MEDIUM')
  const [runId, setRunId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error')
  const [mergeRun, setMergeRun] = useState<RunSummary>()
  const [preflight, setPreflight] = useState<MergePreflight>()
  const [preflightBusy, setPreflightBusy] = useState(false)
  const [mergeBusy, setMergeBusy] = useState(false)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)

  const showMessage = useCallback((value: string, tone: 'error' | 'success' = 'error') => {
    setMessage(value); setMessageTone(tone)
  }, [])

  const loadRuns = useCallback(async () => {
    if (!window.harness || !selectedProjectId) return
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.listRuns(selectedProjectId)
      if (!Array.isArray(result)) throw new Error(result.error)
      setRuns(result)
      const selected = result.find((run) => run.active)
      if (selected && !selectedRunId) updateActiveRun(selected, selected.revision)
      await refreshTerminals()
    } catch (cause) { showMessage(cause instanceof Error ? explainRunError(cause.message) : 'Failed to load tasks') }
    finally { setBusy(false) }
  }, [selectedProjectId, selectedRunId, updateActiveRun, refreshTerminals, showMessage])

  useEffect(() => { void loadRuns() }, [loadRuns])

  async function createRun(): Promise<void> {
    if (!window.harness || !runId.trim()) { showMessage('Run ID is required.'); return }
    setBusy(true); setMessage('')
    try {
      const result = await window.harness.createRun(selectedProjectId, intent, risk, runId.trim(), revision || undefined)
      if (result.error) throw new Error(String(result.error))
      updateActiveRun(runFromState(result.run as Record<string, unknown>), String(result.revision || ''))
      setRunId(''); setShowCreate(false); await loadRuns()
    } catch (cause) { showMessage(cause instanceof Error ? explainRunError(cause.message) : 'Create failed') }
    finally { setBusy(false) }
  }

  async function runAction(action: 'switch' | 'pause' | 'resume' | 'archive', run: RunSummary): Promise<void> {
    if (!window.harness) return
    setBusy(true); setMessage('')
    try {
      const fn = action === 'switch' ? window.harness.switchRun : action === 'pause' ? window.harness.pauseRun : action === 'resume' ? window.harness.resumeRun : window.harness.archiveRun
      const result = await fn(selectedProjectId, run.run_id, run.revision || undefined)
      if (result.error) throw new Error(String(result.error))
      updateActiveRun(runFromState(result.run as Record<string, unknown>), String(result.revision || ''))
      await loadRuns()
    } catch (cause) { showMessage(cause instanceof Error ? explainRunError(cause.message) : `${action} failed`) }
    finally { setBusy(false) }
  }

  async function loadPreflight(run: RunSummary): Promise<void> {
    if (!window.harness) return
    setPreflightBusy(true); setPreflight(undefined); setReviewConfirmed(false)
    try {
      const result = await window.harness.preflightRunMergeBack(selectedProjectId, run.run_id, run.revision || undefined)
      if (result.error) throw new Error(String(result.error))
      setPreflight(result as unknown as MergePreflight)
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Merge preflight failed'
      setPreflight({
        runId: run.run_id, revision: run.revision, status: 'blocked', canMerge: false,
        targetBranch: '', branchName: run.branch_name || '', targetHead: '', runHead: '', ahead: 0, behind: 0, fastForward: false,
        targetStatus: { total: 0, entries: [], truncated: false }, runStatus: { total: 0, entries: [], truncated: false }, commits: [],
        files: { total: 0, entries: [], truncated: false }, fileSummary: { added: 0, modified: 0, deleted: 0, renamed: 0, other: 0 },
        issues: [{ code: 'PREFLIGHT_FAILED', severity: 'blocking', title: 'Merge preflight failed', description: detail, action: 'Review technical details and refresh.', details: [detail] }],
      })
    } finally { setPreflightBusy(false) }
  }

  function openMergeAssistant(run: RunSummary): void {
    setMergeRun(run); setPreflight(undefined); setReviewConfirmed(false); void loadPreflight(run)
  }

  async function mergeBack(): Promise<void> {
    if (!window.harness || !mergeRun || !canExecuteMerge(preflight) || !reviewConfirmed) return
    const settings = loadLocalSettings()
    const authorization = authorizePolicy(settings.policy.gitCommit, `将任务 ${mergeRun.run_id} 的代码合并到主项目 ${preflight?.targetBranch || ''}？`)
    if (!authorization.allowed) {
      if (authorization.blocked) showMessage(policyBlockedMessage('Run merge-back'))
      return
    }
    setMergeBusy(true)
    try {
      const result = await window.harness.mergeRunBack(selectedProjectId, mergeRun.run_id, preflight?.revision || mergeRun.revision || undefined, settings.policy.gitCommit === 'ask')
      if (result.error) throw new Error(String(result.error))
      updateActiveRun(runFromState(result.run as Record<string, unknown>), String(result.revision || ''))
      const merge = result.merge as Record<string, unknown> | undefined
      showMessage(`任务代码已合并到主项目 ${String(merge?.targetBranch || '')}`, 'success')
      setMergeRun(undefined); setPreflight(undefined); await loadRuns()
    } catch (cause) {
      showMessage(cause instanceof Error ? explainRunError(cause.message) : 'Merge back failed')
      await loadPreflight(mergeRun)
    } finally { setMergeBusy(false) }
  }

  async function openRunTerminal(): Promise<void> {
    if (!mergeRun) return
    await selectRun(mergeRun.run_id)
    setMergeRun(undefined)
    navigate('/execution')
  }

  async function copyManualCommand(): Promise<void> {
    if (!mergeRun || !preflight) return
    const command = preflight.issues.some((issue) => issue.code === 'RUN_WORKTREE_DIRTY')
      ? `git -C "${mergeRun.worktree_path || ''}" status`
      : preflight.issues.some((issue) => issue.code === 'NON_FAST_FORWARD')
        ? `git log --oneline --left-right ${preflight.targetBranch}...${preflight.branchName}`
        : 'git status'
    await navigator.clipboard.writeText(command)
    showMessage('已复制 Git 检查命令。', 'success')
  }

  return (
    <section className="page runs-page">
      <header className="page-header"><h1>Runs</h1><div className="actions">
        <button className="button icon-button" onClick={() => void loadRuns()} title={text('Refresh runs', '刷新运行')} aria-label={text('Refresh runs', '刷新运行')}><RefreshCw size={15} /></button>
        <button className="button primary" onClick={() => setShowCreate((value) => !value)}>{text('New run', '新建运行')}</button>
      </div></header>
      {message && <div className={`notice ${messageTone}`}>{message}</div>}
      {showCreate && <div className="panel form-row">
        <label className="field">Run ID<input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="feature-20260723" /></label>
        <label className="field">Intent<select value={intent} onChange={(event) => setIntent(event.target.value)}>{INTENTS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field">Risk<select value={risk} onChange={(event) => setRisk(event.target.value)}>{RISKS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="run-create-preview"><strong>Preview</strong><span>Branch: <code>codex/{runId.trim() || 'new-run'}</code></span><span>Harness bootstrap and worktree paths will be shown after creation.</span></div>
        <button className="button primary" disabled={busy} onClick={() => void createRun()}>{text('Create', '创建')}</button>
        <button className="button" onClick={() => setShowCreate(false)}>{text('Cancel', '取消')}</button>
      </div>}
      <div className="panel runs-table-panel">
        {runs.length === 0 && !busy ? <div className="empty-state"><h2>No tasks</h2><p>Create a task from the project workflow.</p></div> :
          <table className="data-table"><thead><tr><th>Run ID</th><th>Intent / Risk</th><th>Status</th><th>Current node</th><th>Progress</th><th /></tr></thead>
          <tbody>{runs.filter((run) => !run.archived).map((run) => {
            const terminal = Object.values(terminalSessionsById).find((item) => item.runId === run.run_id && (item.status === 'running' || item.status === 'starting'))
            const merge = mergeStatus(run)
            return <tr key={run.run_id} className={run.run_id === selectedRunId ? 'selected' : ''} onClick={() => void selectRun(run.run_id).catch((cause) => showMessage(cause instanceof Error ? cause.message : 'Selection failed'))}>
              <td className="mono"><strong>{run.run_id}</strong>{run.run_id === selectedRunId && <span className="badge success run-selected-badge">SELECTED</span>}
                {run.branch_name && <div className="table-subtext" title={run.branch_name}>Branch: {run.branch_name}</div>}
                {run.worktree_path && <div className="table-subtext" title={run.worktree_path}>Worktree: {run.worktree_path}</div>}
              </td>
              <td>{run.intent} <span className="muted">/ {run.risk}</span></td>
              <td><span className={`badge ${run.status === 'BLOCKED' ? 'danger' : run.status === 'DONE' ? 'success' : ''}`}>{run.status}</span><div className="table-subtext"><span className={`badge ${merge.className}`} title={merge.title}>{merge.label}</span></div></td>
              <td>{run.current_node}</td><td>{run.completed_nodes.length}/{run.required_nodes.length}</td>
              <td><div className="actions run-row-actions">
                {terminal && <button className="button" title={text('Open running terminal', '打开运行中的终端')} onClick={(event) => { event.stopPropagation(); void selectRun(run.run_id).then(() => navigate('/execution')).catch((cause) => showMessage(cause instanceof Error ? cause.message : 'Selection failed')) }}><SquareTerminal size={15} /><span className="badge success">{terminal.status}</span></button>}
                {run.branch_name && run.worktree_path && !run.merged_back && <button className="button icon-button" title={text('Inspect and merge task code', '检查并合并任务代码')} onClick={(event) => { event.stopPropagation(); openMergeAssistant(run) }}><GitMerge size={15} /></button>}
                {!run.active && <button className="button" title={text('Make selected run authoritative', '设为当前权威运行')} onClick={(event) => { event.stopPropagation(); void runAction('switch', run) }}>{text('Select', '选择')}</button>}
                {run.blocked_by.includes('user_paused') && <button className="button icon-button" title={text('Resume run', '恢复运行')} onClick={(event) => { event.stopPropagation(); void runAction('resume', run) }}><Play size={15} /></button>}
                {!run.blocked_by.includes('user_paused') && <button className="button icon-button" title={text('Pause run', '暂停运行')} onClick={(event) => { event.stopPropagation(); void runAction('pause', run) }}><Pause size={15} /></button>}
                <button className="button icon-button" title={text('Archive run', '归档运行')} onClick={(event) => { event.stopPropagation(); void runAction('archive', run) }}><Archive size={15} /></button>
              </div></td>
            </tr>
          })}</tbody></table>}
      </div>

      {mergeRun && <div className="run-merge-backdrop" onMouseDown={() => !mergeBusy && setMergeRun(undefined)}>
        <aside className="run-merge-drawer" onMouseDown={(event) => event.stopPropagation()}>
          <header className="run-merge-head"><div><span className="run-merge-icon"><GitMerge size={19} /></span><div><h2>任务代码合并</h2><code>{mergeRun.run_id}</code></div></div><button className="button icon-button" disabled={mergeBusy} onClick={() => setMergeRun(undefined)}><X size={16} /></button></header>
          {preflightBusy && <div className="run-merge-loading"><RefreshCw className="spin" size={18} /><strong>正在检查是否可以安全合并...</strong><span>检查过程不会改动任何代码或版本记录。</span></div>}
          {preflight && !preflightBusy && <div className="run-merge-body">
            <section className={`run-merge-verdict ${canExecuteMerge(preflight) ? 'ready' : 'blocked'}`}>
              {canExecuteMerge(preflight) ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
              <div><strong>{canExecuteMerge(preflight) ? '可以安全合并' : '暂时不能自动合并'}</strong><p>{canExecuteMerge(preflight) ? '主项目在任务创建后没有新增代码版本。确认后，任务修改会直接加入主项目，不会产生冲突或额外的合并记录。' : '为了避免覆盖代码，软件已停止处理，主项目和任务代码都没有被更改。'}</p></div>
            </section>
            <section className="run-merge-branches"><div><span>主项目</span><strong>{preflight.targetBranch || 'Unavailable'}</strong><code>{preflight.targetHead?.slice(0, 12) || '-'}</code></div><GitMerge size={18} /><div><span>任务代码</span><strong>{preflight.branchName || mergeRun.branch_name}</strong><code>{preflight.runHead?.slice(0, 12) || '-'}</code></div></section>
            <section className="run-merge-metrics">
              <div><span>此任务新增版本</span><strong>{preflight.ahead}</strong></div><div><span>主项目新增版本</span><strong>{preflight.behind}</strong></div><div><span>变更文件</span><strong>{preflight.files.total}</strong></div><div><span>处理方式</span><strong>{preflight.fastForward ? '可直接合并' : '需要人工处理'}</strong></div>
            </section>
            <details className="run-merge-technical"><summary>查看技术详情</summary><dl><div><dt>Git 合并方式</dt><dd>{preflight.fastForward ? 'Fast-forward only' : 'Manual integration required'}</dd></div><div><dt>Target HEAD</dt><dd><code>{preflight.targetHead || '-'}</code></dd></div><div><dt>Run HEAD</dt><dd><code>{preflight.runHead || '-'}</code></dd></div></dl></details>
            {preflight.issues.length > 0 && <section className="run-merge-issues"><h3>需要处理</h3>{preflight.issues.map((issue) => { const copy = issueCopy(issue); return <article key={issue.code} className="run-merge-issue"><AlertTriangle size={17} /><div><div className="run-merge-issue-title"><strong>{copy.title}</strong><code>{issue.code}</code></div><p>{copy.description}</p><div className="run-merge-action-hint">{copy.action}</div>{issue.details.length > 0 && <details><summary>技术详情</summary><pre>{issue.details.join('\n')}</pre></details>}</div></article> })}</section>}
            {preflight.files.total > 0 && <section className="run-merge-section"><h3><FileDiff size={16} />文件变化 <span>{preflight.files.total}</span></h3><div className="run-merge-file-summary"><span className="added">+{preflight.fileSummary.added}</span><span className="modified">M {preflight.fileSummary.modified}</span><span className="deleted">-{preflight.fileSummary.deleted}</span><span>R {preflight.fileSummary.renamed}</span></div><div className="run-merge-list">{preflight.files.entries.map((file) => <div key={`${file.status}-${file.path}`}><span className={`file-status status-${file.status.slice(0, 1).toLowerCase()}`}>{file.status}</span><code title={file.path}>{file.path}</code></div>)}</div>{preflight.files.truncated && <p className="run-merge-truncated">仅展示前 {preflight.files.entries.length} 个文件。</p>}</section>}
            {preflight.commits.length > 0 && <section className="run-merge-section"><h3><GitCommit size={16} />将加入主项目的版本记录 <span>{preflight.commits.length}</span></h3><div className="run-merge-commits">{preflight.commits.map((commit) => <div key={commit.hash}><code>{commit.hash.slice(0, 8)}</code><div><strong>{commit.subject}</strong><span>{commit.author} · {commit.authoredAt ? new Date(commit.authoredAt).toLocaleString() : ''}</span></div></div>)}</div></section>}
            {canExecuteMerge(preflight) && <label className="run-merge-confirm"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span><strong>我已查看上述版本记录和文件变化</strong><small>确认时软件会再次检查主项目和任务代码，避免状态变化导致错误合并。</small></span></label>}
          </div>}
          <footer className="run-merge-footer"><div className="run-merge-manual-actions"><button className="button" disabled={preflightBusy || mergeBusy} onClick={() => void loadPreflight(mergeRun)}><RefreshCw size={14} />重新检查</button>{preflight && !canExecuteMerge(preflight) && <button className="button" onClick={() => void copyManualCommand()}><Clipboard size={14} />复制给开发人员的检查命令</button>}{preflight?.issues.some((issue) => issue.code === 'RUN_WORKTREE_DIRTY') && <button className="button" onClick={() => void openRunTerminal()}><SquareTerminal size={14} />打开任务终端</button>}</div><button className="button primary" disabled={!reviewConfirmed || !canExecuteMerge(preflight) || mergeBusy || preflightBusy} onClick={() => void mergeBack()}>{mergeBusy ? '正在合并到主项目...' : '确认合并到主项目'}</button></footer>
        </aside>
      </div>}
    </section>
  )
}

export function RunsPage(): React.ReactElement { return <ProjectRequired><TasksContent /></ProjectRequired> }
