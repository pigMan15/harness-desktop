import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { Clipboard, Copy, Play, RefreshCw, Search, Square, Trash2 } from 'lucide-react'
import type { RunSummary, TerminalSessionSummary } from '../../app/harness-api'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

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

function TerminalContent(): React.ReactElement {
  const { selectedProjectId, selectedRun, terminalSessionsById, refreshTerminals, updateActiveRun } = useWorkspace()
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

  const matchingSession = useMemo(() => Object.values(terminalSessionsById)
    .filter((item) => item.projectId === selectedProjectId && item.runId === selectedRun?.run_id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
  [selectedProjectId, selectedRun?.run_id, terminalSessionsById])

  const loadContext = useCallback(async () => {
    if (!window.harness || !selectedRun) { setContext(undefined); return }
    const result = await window.harness.getRunExecutionContext(selectedProjectId, selectedRun.run_id, selectedRun.revision)
    if (result.error) { setMessage(String(result.error)); return }
    setContext(result as unknown as ExecutionContext)
  }, [selectedProjectId, selectedRun])

  useEffect(() => { void loadContext() }, [loadContext])
  useEffect(() => { setSession(matchingSession) }, [matchingSession])

  useEffect(() => {
    if (!hostRef.current) return
    const terminal = new Terminal({
      convertEol: true, cursorBlink: true, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13,
      theme: { background: '#111315', foreground: '#e8eaed', cursor: '#8ab4f8', selectionBackground: '#3f526b' },
      scrollback: 5000,
    })
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.open(hostRef.current)
    terminalRef.current = terminal
    fitRef.current = fitAddon
    searchRef.current = searchAddon
    fitAddon.fit()
    if (session?.sessionId && window.harness) {
      void window.harness.getTerminalScrollback(session.sessionId).then((replay) => { if (replay.data) terminal.write(replay.data) })
    } else if (session?.summary) {
      terminal.write(session.summary)
    }
    const input = terminal.onData((data) => { if (session?.sessionId) void window.harness?.writeTerminal(session.sessionId, data) })
    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        fitAddon.fit()
        if (session?.sessionId && window.harness) void window.harness.resizeTerminal(session.sessionId, terminal.cols, terminal.rows)
      })
    })
    observer.observe(hostRef.current)
    return () => { observer.disconnect(); cancelAnimationFrame(resizeFrame); input.dispose(); terminal.dispose(); terminalRef.current = undefined }
  }, [session?.sessionId])

  useEffect(() => {
    if (!window.harness) return
    const offData = window.harness.onTerminalData((event) => {
      if (event.sessionId === session?.sessionId && event.data) terminalRef.current?.write(event.data)
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

  async function start(kind: 'codex' | 'shell'): Promise<void> {
    if (!window.harness || !selectedRun || !terminalRef.current) return
    setBusy(true); setMessage('')
    try {
      const created = await window.harness.createTerminal({
        projectId: selectedProjectId, runId: selectedRun.run_id, kind,
        cols: terminalRef.current.cols || 120, rows: terminalRef.current.rows || 30,
      })
      setSession(created)
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
    terminalRef.current?.clear()
    await refreshTerminals()
  }

  async function complete(decision?: 'accept' | 'reject' | 'defer'): Promise<void> {
    if (!window.harness || !selectedRun) return
    setBusy(true); setMessage('')
    try {
      const result = decision
        ? await window.harness.confirmNode(selectedProjectId, selectedRun.run_id, decision, comment, selectedRun.revision)
        : await window.harness.completeNode(selectedProjectId, selectedRun.run_id, selectedRun.revision)
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
      <button className="button primary" disabled={busy || active || !context?.terminalAllowed} onClick={() => void start('codex')}><Play size={15} />Start Codex</button>
      <button className="button" disabled={busy || active || !context?.terminalAllowed} onClick={() => void start('shell')}>Open Shell</button>
      <button className="button danger" disabled={!active} onClick={() => void stop()}><Square size={15} />Stop</button>
      <button className="button" disabled={!session || active} onClick={() => void restart()} title="Restart terminal"><RefreshCw size={15} /></button>
      <button className="button" onClick={() => terminalRef.current?.clear()} title="Clear terminal"><Trash2 size={15} /></button>
    </div></header>
    {message && <div className="notice error">{message}</div>}
    {!selectedRun && <div className="notice">Select a run before starting a terminal.</div>}
    {context && <div className="terminal-context">
      <span><small>Run</small><strong className="mono">{context.runId}</strong></span>
      <span><small>Node / Role</small><strong>{context.currentNode} / {context.nextRole}</strong></span>
      <span className="grow"><small>Worktree</small><strong className="mono truncate">{context.worktreePath}</strong></span>
      <span><small>Session</small><strong className={`badge ${active ? 'success' : ''}`}>{session?.status || 'idle'}</strong></span>
    </div>}
    {context && !context.terminalAllowed && <div className="notice error">{context.terminalBlockReason || 'Terminal is not available for this run.'}</div>}
    <div className="terminal-tools">
      <div className="terminal-search"><Search size={14} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchRef.current?.findNext(searchText) }} placeholder="Find" /></div>
      <button className="button icon-button" title="Copy selection" onClick={() => void navigator.clipboard.writeText(terminalRef.current?.getSelection() || '')}><Copy size={15} /></button>
      <button className="button icon-button" title="Paste" onClick={() => void navigator.clipboard.readText().then((text) => session && window.harness?.writeTerminal(session.sessionId, text))}><Clipboard size={15} /></button>
    </div>
    <div className="terminal-host" ref={hostRef} />
    {selectedRun && context && <div className="node-controls">
      <div><strong>{context.currentNode}</strong><span className="muted">Expected artifact: {context.phaseDir}</span></div>
      {CONFIRMATION_NODES.has(context.currentNode) ? <>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Decision comment" />
        <button className="button primary" disabled={busy} onClick={() => void complete('accept')}>Accept</button>
        <button className="button" disabled={busy} onClick={() => void complete('defer')}>Defer</button>
        <button className="button danger" disabled={busy || !comment.trim()} onClick={() => void complete('reject')}>Reject</button>
      </> : <button className="button primary" disabled={busy} onClick={() => void complete()}>Complete current node</button>}
    </div>}
  </section>
}

export function TerminalPage(): React.ReactElement { return <ProjectRequired><TerminalContent /></ProjectRequired> }
