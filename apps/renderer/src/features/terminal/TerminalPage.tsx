import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { Clipboard, Copy, Play, RefreshCw, Search, Square, Trash2 } from 'lucide-react'
import type { RunSummary, TerminalSessionSummary } from '../../app/harness-api'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'
import { authorizePolicy, loadLocalSettings, policyBlockedMessage } from '../settings/settings-policy'
import { useLanguage } from '../settings/LanguageContext'

interface ExecutionContext {
  runId: string
  revision: string
  status: string
  currentNode: string
  nextRole: string
  phaseDir: string
  worktreePath: string
  branchName?: string
  terminalAllowed: boolean
  terminalBlockReason?: string
}

const CONFIRMATION_NODES = new Set([
  'REQUIREMENT_CONFIRMATION', 'SOLUTION_CONFIRMATION', 'ACCEPTANCE_CONFIRMATION', 'CODING_DESIGN_CONFIRMATION',
])

function runFromResult(result: Record<string, unknown>): RunSummary | undefined {
  const state = result.run as Record<string, unknown> | undefined
  if (!state) return undefined
  return {
    run_id: String(state.run_id || ''), intent: String(state.intent || ''), risk: String(state.risk || ''),
    status: String(state.status || ''), current_node: String(state.current_node || ''), next_role: String(state.next_role || ''),
    completed_nodes: (state.completed_nodes as string[]) || [], required_nodes: (state.required_nodes as string[]) || [],
    blocked_by: (state.blocked_by as string[]) || [], phase_dir: String(state.phase_dir || ''), active: true,
    revision: String(result.revision || ''), branch_name: state.branch_name ? String(state.branch_name) : undefined,
    worktree_path: state.worktree_path ? String(state.worktree_path) : undefined,
  }
}

function isTerminalSessionNotFound(cause: unknown): boolean {
  return String(cause instanceof Error ? cause.message : cause).includes('TERMINAL_SESSION_NOT_FOUND')
}

function terminalBufferText(terminal: Terminal | undefined, recentRows?: number): string {
  if (!terminal) return ''
  const buffer = terminal.buffer.active
  const start = Math.max(0, buffer.length - (recentRows || buffer.length))
  const lines: string[] = []
  for (let index = start; index < buffer.length; index += 1) {
    lines.push(buffer.getLine(index)?.translateToString(true) || '')
  }
  return lines.join('\n').replace(/\n+$/g, '')
}

function formatClock(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString()
}

function TerminalContent(): React.ReactElement {
  const { text } = useLanguage()
  const { selectedProjectId, selectedRun, terminalSessionsById, refreshTerminals, updateActiveRun } = useWorkspace()
  const defaultAiProvider = useMemo(() => loadLocalSettings().defaultProvider, [])
  const secondaryAiProvider = defaultAiProvider === 'codex' ? 'claude' : 'codex'
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal>()
  const fitRef = useRef<FitAddon>()
  const searchRef = useRef<SearchAddon>()
  const [context, setContext] = useState<ExecutionContext>()
  const [session, setSession] = useState<TerminalSessionSummary>()
  const [message, setMessage] = useState('')
  const [searchText, setSearchText] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [staleSessionIds, setStaleSessionIds] = useState<Set<string>>(() => new Set())
  const [lastOutputAt, setLastOutputAt] = useState('')
  const [autoFollow, setAutoFollow] = useState(true)
  const [pendingPaste, setPendingPaste] = useState('')
  const autoFollowRef = useRef(true)

  const setFollowMode = useCallback((enabled: boolean): void => {
    autoFollowRef.current = enabled
    setAutoFollow(enabled)
  }, [])

  const matchingSession = useMemo(() => Object.values(terminalSessionsById)
    .filter((item) => item.projectId === selectedProjectId && item.runId === selectedRun?.run_id)
    .filter((item) => !staleSessionIds.has(item.sessionId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
  [selectedProjectId, selectedRun?.run_id, staleSessionIds, terminalSessionsById])

  const markTerminalSessionStale = useCallback((sessionId: string) => {
    setStaleSessionIds((current) => new Set([...current, sessionId]))
    setSession((current) => current?.sessionId === sessionId ? undefined : current)
    void refreshTerminals()
  }, [refreshTerminals])

  const writeTerminalText = useCallback(async (text: string): Promise<void> => {
    if (!text || !session?.sessionId || !window.harness) return
    try {
      await window.harness.writeTerminal(session.sessionId, text)
    } catch (cause) {
      if (isTerminalSessionNotFound(cause)) {
        markTerminalSessionStale(session.sessionId)
        return
      }
      setMessage(cause instanceof Error ? cause.message : 'Terminal paste failed')
    }
  }, [markTerminalSessionStale, session?.sessionId])

  const pasteClipboardText = useCallback(async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.split(/\r?\n/).filter(Boolean).length > 1) {
        setPendingPaste(text)
        return
      }
      await writeTerminalText(text)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Clipboard text paste failed')
    }
  }, [writeTerminalText])

  const confirmPendingPaste = useCallback(async (): Promise<void> => {
    const text = pendingPaste
    setPendingPaste('')
    await writeTerminalText(text)
  }, [pendingPaste, writeTerminalText])

  const loadContext = useCallback(async () => {
    if (!window.harness || !selectedRun) { setContext(undefined); return }
    let result = await window.harness.getRunExecutionContext(selectedProjectId, selectedRun.run_id, selectedRun.revision)
    if (result.error === 'REVISION_CONFLICT') {
      result = await window.harness.getRunExecutionContext(selectedProjectId, selectedRun.run_id)
    }
    if (result.error) { setMessage(String(result.error)); return }
    setContext(result as unknown as ExecutionContext)
  }, [selectedProjectId, selectedRun])

  useEffect(() => { void loadContext() }, [loadContext])
  useEffect(() => { setSession(matchingSession) }, [matchingSession])

  useEffect(() => {
    if (!hostRef.current) return
    const terminal = new Terminal({
      convertEol: true, cursorBlink: true,
      fontFamily: '"Cascadia Mono", Consolas, "Microsoft YaHei UI", "Microsoft YaHei", monospace', fontSize: 13,
      theme: { background: '#111315', foreground: '#e8eaed', cursor: '#8ab4f8', selectionBackground: '#3f526b' },
      scrollback: 5000,
    })
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      // Let xterm's composition helper own IME keystrokes (for example, Chinese input).
      if (event.isComposing || event.key === 'Process' || event.keyCode === 229) return true
      const key = event.key.toLowerCase()
      const pasteShortcut = (key === 'v' && (event.ctrlKey || event.metaKey)) || (event.key === 'Insert' && event.shiftKey)
      if (!pasteShortcut) return true
      event.preventDefault()
      void pasteClipboardText()
      return false
    })
    terminal.open(hostRef.current)
    terminal.focus()
    terminalRef.current = terminal
    fitRef.current = fitAddon
    searchRef.current = searchAddon
    let resizeFrame = 0
    let fitReadyAttempts = 0
    let lastTerminalSize = { cols: 0, rows: 0 }
    let replayingScrollback = false
    let pendingInput = ''
    let disposed = false
    const fitTerminal = () => {
      const bounds = hostRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false
      const dimensions = (terminal as unknown as { _core?: { _renderService?: { dimensions?: { css?: { cell?: { width: number; height: number } } } } } })
        ._core?._renderService?.dimensions
      if (!dimensions?.css?.cell?.width || !dimensions.css.cell.height) return false
      try {
        fitAddon.fit()
        return true
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : 'Terminal fit failed')
        return false
      }
    }
    const scheduleInitialFit = () => {
      resizeFrame = requestAnimationFrame(() => {
        if (!fitTerminal() && fitReadyAttempts < 8) {
          fitReadyAttempts += 1
          scheduleInitialFit()
        }
      })
    }
    scheduleInitialFit()
    const finishReplay = () => {
      requestAnimationFrame(() => {
        if (disposed) return
        replayingScrollback = false
        const inputAfterReplay = pendingInput
        pendingInput = ''
        if (inputAfterReplay) void writeTerminalText(inputAfterReplay)
        if (autoFollowRef.current) terminal.scrollToBottom()
        terminal.focus()
      })
    }
    const input = terminal.onData((data) => {
      if (replayingScrollback) {
        pendingInput += data
        return
      }
      void writeTerminalText(data)
    })
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain') || ''
      if (!text) return
      event.preventDefault()
      if (text.split(/\r?\n/).filter(Boolean).length > 1) {
        setPendingPaste(text)
        return
      }
      void writeTerminalText(text)
    }
    hostRef.current.addEventListener('paste', handlePaste)
    const scrollDisposable = terminal.onScroll(() => {
      const buffer = terminal.buffer.active
      setFollowMode(buffer.viewportY + terminal.rows >= buffer.baseY + buffer.length - 1)
    })
    if (session?.sessionId && window.harness) {
      replayingScrollback = true
      void window.harness.getTerminalScrollback(session.sessionId).then((replay) => {
        if (disposed) return
        if (replay.missing) {
          finishReplay()
          markTerminalSessionStale(session.sessionId)
          return
        }
        if (replay.data) terminal.write(replay.data, finishReplay)
        else finishReplay()
      }).catch((cause) => {
        finishReplay()
        if (isTerminalSessionNotFound(cause)) {
          markTerminalSessionStale(session.sessionId)
          return
        }
        setMessage(cause instanceof Error ? cause.message : 'Terminal scrollback failed')
      })
    } else if (session?.summary) {
      replayingScrollback = true
      terminal.write(session.summary, finishReplay)
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        if (!fitTerminal()) return
        if (!session?.sessionId || !window.harness) return
        if (lastTerminalSize.cols === terminal.cols && lastTerminalSize.rows === terminal.rows) return
        // xterm fit 会改写内部 DOM；只同步真实行列变化，避免 ResizeObserver 形成空闲反馈循环。
        lastTerminalSize = { cols: terminal.cols, rows: terminal.rows }
        void window.harness.resizeTerminal(session.sessionId, terminal.cols, terminal.rows).catch((cause) => {
          if (isTerminalSessionNotFound(cause)) {
            markTerminalSessionStale(session.sessionId)
            return
          }
          setMessage(cause instanceof Error ? cause.message : 'Terminal resize failed')
        })
      })
    })
    observer.observe(hostRef.current)
    return () => { disposed = true; observer.disconnect(); hostRef.current?.removeEventListener('paste', handlePaste); cancelAnimationFrame(resizeFrame); scrollDisposable.dispose(); input.dispose(); terminal.dispose(); terminalRef.current = undefined }
  }, [markTerminalSessionStale, pasteClipboardText, session?.sessionId, setFollowMode, writeTerminalText])

  useEffect(() => {
    if (!window.harness) return
    const offData = window.harness.onTerminalData((event) => {
      if (event.sessionId === session?.sessionId && event.data) {
        setLastOutputAt(new Date().toISOString())
        terminalRef.current?.write(event.data, () => {
          if (autoFollowRef.current) terminalRef.current?.scrollToBottom()
        })
      }
    })
    const offExit = window.harness.onTerminalExit((event) => {
      if (event.sessionId === session?.sessionId) {
        setSession((current) => current ? { ...current, ...event } as TerminalSessionSummary : current)
        terminalRef.current?.writeln(`\r\n[process exited: ${event.exitCode ?? 'unknown'}]`)
      }
    })
    const offStatus = window.harness.onTerminalStatus((event) => {
      if (event.sessionId === session?.sessionId) setSession((current) => current ? { ...current, ...event } as TerminalSessionSummary : current)
    })
    return () => { offData(); offExit(); offStatus() }
  }, [session?.sessionId])

  async function start(kind: 'codex' | 'claude' | 'shell'): Promise<void> {
    if (!window.harness || !selectedRun || !terminalRef.current) return
    const settings = loadLocalSettings()
    const label = kind === 'shell' ? 'Open a shell' : `Start ${kind === 'claude' ? 'Claude Code' : 'Codex'}`
    const authorization = authorizePolicy(settings.policy.commandExecution, `${label} for run ${selectedRun.run_id}?`)
    if (!authorization.allowed) {
      if (authorization.blocked) setMessage(policyBlockedMessage(label))
      return
    }
    setBusy(true); setMessage('')
    try {
      const created = await window.harness.createTerminal({
        projectId: selectedProjectId,
        runId: selectedRun.run_id,
        kind: kind === 'claude' ? 'ai' : kind,
        provider: kind === 'shell' ? undefined : kind,
        policyConfirmed: settings.policy.commandExecution === 'ask',
        cols: terminalRef.current.cols || 120, rows: terminalRef.current.rows || 30,
      })
      setSession(created)
      setLastOutputAt('')
      setFollowMode(true)
      await refreshTerminals()
      terminalRef.current.focus()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Terminal start failed') }
    finally { setBusy(false) }
  }

  async function stop(): Promise<void> {
    if (!window.harness || !session) return
    setSession(await window.harness.stopTerminal(session.sessionId))
    await refreshTerminals()
  }

  async function restart(): Promise<void> {
    if (!window.harness || !session) return
    setSession(await window.harness.restartTerminal(session.sessionId))
    setLastOutputAt('')
    setFollowMode(true)
    terminalRef.current?.clear()
    await refreshTerminals()
  }

  async function complete(decision?: 'accept' | 'reject' | 'defer'): Promise<void> {
    if (!window.harness || !selectedRun) return
    setBusy(true); setMessage('')
    try {
      const result = decision
        ? await window.harness.confirmNode(selectedProjectId, selectedRun.run_id, decision, comment, context?.revision || selectedRun.revision)
        : await window.harness.completeNode(selectedProjectId, selectedRun.run_id, context?.revision || selectedRun.revision)
      if (result.error) throw new Error(String(result.error))
      const updated = runFromResult(result)
      if (updated) updateActiveRun(updated, String(result.revision || ''))
      setComment('')
      await loadContext()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Node update failed') }
    finally { setBusy(false) }
  }

  const active = session?.status === 'starting' || session?.status === 'running'
  return <section className="page terminal-page">
    <header className="page-header"><h1>Terminal</h1><div className="actions">
      <button className="button primary" disabled={busy || active || !context?.terminalAllowed} onClick={() => void start(defaultAiProvider)}><Play size={15} />{text('Start', '启动')} {defaultAiProvider === 'claude' ? 'Claude Code' : 'Codex'}</button>
      <button className="button" disabled={busy || active || !context?.terminalAllowed} onClick={() => void start(secondaryAiProvider)}><Play size={15} />{text('Start', '启动')} {secondaryAiProvider === 'claude' ? 'Claude Code' : 'Codex'}</button>
      <button className="button" disabled={busy || active || !context?.terminalAllowed} onClick={() => void start('shell')}>{text('Open Shell', '打开 Shell')}</button>
      <button className="button danger" disabled={!active} onClick={() => void stop()}><Square size={15} />{text('Stop', '停止')}</button>
      <button className="button" disabled={!session || active} onClick={() => void restart()} title={text('Restart terminal', '重启终端')}><RefreshCw size={15} /></button>
      <button className="button" onClick={() => terminalRef.current?.clear()} title={text('Clear terminal', '清空终端')}><Trash2 size={15} /></button>
    </div></header>
    {message && <div className="notice error">{message}</div>}
    {pendingPaste && <div className="notice terminal-paste-confirm">
      <div><strong>Paste {pendingPaste.split(/\r?\n/).filter(Boolean).length} lines?</strong><span>Multi-line paste is held for confirmation before writing to the terminal.</span></div>
      <pre>{pendingPaste.slice(0, 1200)}</pre>
      <div className="actions">
        <button className="button primary" onClick={() => void confirmPendingPaste()}>{text('Paste', '粘贴')}</button>
        <button className="button" onClick={() => setPendingPaste('')}>{text('Cancel', '取消')}</button>
      </div>
    </div>}
    {!selectedRun && <div className="notice">Select a run before starting a terminal.</div>}
    {context && <div className="terminal-context">
      <span><small>Run</small><strong className="mono">{context.runId}</strong></span>
      <span><small>Node / Role</small><strong>{context.currentNode} / {context.nextRole}</strong></span>
      <span className="grow"><small>Worktree</small><strong className="mono truncate">{context.worktreePath}</strong></span>
      <span><small>Provider</small><strong>{session?.provider === 'claude' ? 'Claude Code' : session?.provider === 'codex' || session?.kind === 'codex' ? 'Codex' : session?.kind || 'none'}</strong></span>
      <span><small>PID</small><strong className="mono">{session?.pid || '-'}</strong></span>
      <span><small>Last output</small><strong className="mono">{formatClock(lastOutputAt || session?.startedAt)}</strong></span>
      <span><small>Follow</small><strong className={`badge ${autoFollow ? 'success' : 'warning'}`}>{autoFollow ? 'auto' : 'paused'}</strong></span>
      <span><small>Session</small><strong className={`badge ${active ? 'success' : ''}`}>{session?.status || 'idle'}</strong></span>
    </div>}
    {context && !context.terminalAllowed && <div className="notice error">{context.terminalBlockReason || 'Terminal is not available for this run.'}</div>}
    <div className="terminal-tools">
      <div className="terminal-search"><Search size={14} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchRef.current?.findNext(searchText) }} placeholder="Find" /></div>
      <button className="button icon-button" title={text('Copy selection', '复制选中内容')} onClick={() => void navigator.clipboard.writeText(terminalRef.current?.getSelection() || '')}><Copy size={15} /></button>
      <button className="button" title={text('Copy all terminal output', '复制全部终端输出')} onClick={() => void navigator.clipboard.writeText(terminalBufferText(terminalRef.current))}>{text('Copy all', '复制全部')}</button>
      <button className="button" title={text('Copy recent terminal output', '复制最近终端输出')} onClick={() => void navigator.clipboard.writeText(terminalBufferText(terminalRef.current, 120))}>{text('Copy recent', '复制最近内容')}</button>
      <button className="button" title={text('Resume automatic scrolling', '恢复自动滚动')} onClick={() => { setFollowMode(true); terminalRef.current?.scrollToBottom() }}>{text('Follow', '跟随')}</button>
      <button className="button icon-button" title={text('Paste', '粘贴')} onClick={() => void pasteClipboardText()}><Clipboard size={15} /></button>
    </div>
    <div className="terminal-host" ref={hostRef} />
    {selectedRun && context && <div className="node-controls">
      <div><strong>{context.currentNode}</strong><span className="muted">Expected artifact: {context.phaseDir}</span></div>
      {CONFIRMATION_NODES.has(context.currentNode) ? <>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Decision comment" />
        <button className="button primary" disabled={busy} onClick={() => void complete('accept')}>{text('Accept', '通过')}</button>
        <button className="button" disabled={busy} onClick={() => void complete('defer')}>{text('Defer', '暂缓')}</button>
        <button className="button danger" disabled={busy || !comment.trim()} onClick={() => void complete('reject')}>{text('Reject', '拒绝')}</button>
      </> : <button className="button primary" disabled={busy} onClick={() => void complete()}>{text('Complete current node', '完成当前节点')}</button>}
    </div>}
  </section>
}

export function TerminalPage(): React.ReactElement { return <ProjectRequired><TerminalContent /></ProjectRequired> }
