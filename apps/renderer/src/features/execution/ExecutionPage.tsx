import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

interface Capability { available: boolean; path?: string; version?: string; features?: string[]; diagnostics?: string }
interface LogEntry { type: string; sequence: number; content?: string; error?: string; tool?: string; params?: Record<string, unknown>; message?: string; category?: string; requestId?: number; code?: number }
const DANGEROUS = new Set(['deploy','delete','dangerous_git'])

function ExecutionContent(): React.ReactElement {
  const { selectedProjectId, activeRun, revision } = useWorkspace()
  const [capability, setCapability] = useState<Capability>()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionRunId, setSessionRunId] = useState('')
  const [pendingApproval, setPendingApproval] = useState<LogEntry>()
  const [confirmDangerous, setConfirmDangerous] = useState(false)
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setInterval>>()
  const logEnd = useRef<HTMLDivElement>(null)

  const probe = useCallback(async () => {
    if (!window.harness) return
    setMessage('')
    try {
      const result = await window.harness.probeExecution(selectedProjectId)
      setCapability(result as unknown as Capability)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Codex probe failed') }
  }, [selectedProjectId])

  useEffect(() => { void probe() }, [probe])
  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  function beginPolling(id: string, runId: string): void {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => { void poll(id, runId) }, 500)
  }

  async function poll(id: string, runId: string): Promise<void> {
    if (!window.harness) return
    try {
      const result = await window.harness.pollExecution(selectedProjectId, runId, id)
      if (!Array.isArray(result) || result.length === 0) return
      const events = result as LogEntry[]
      setLogs((current) => {
        const keys = new Set(current.map((entry) => `${entry.type}:${entry.sequence}`))
        return [...current, ...events.filter((entry) => !keys.has(`${entry.type}:${entry.sequence}`))]
      })
      const approval = events.find((entry) => entry.type === 'approval_required')
      if (approval) setPendingApproval(approval)
      if (events.some((entry) => entry.type === 'exited' || entry.type === 'error')) {
        setRunning(false)
        if (timer.current) clearInterval(timer.current)
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Execution polling failed') }
  }

  async function start(): Promise<void> {
    if (!window.harness || !activeRun) { setMessage('Select or create an active task first.'); return }
    setLogs([]); setPendingApproval(undefined); setMessage(''); setRunning(true)
    try {
      const runId = activeRun.run_id
      const result = await window.harness.startExecution(selectedProjectId, runId, revision || activeRun.revision || undefined)
      if (result.error || !result.sessionId) throw new Error(String(result.error || 'Execution start failed'))
      const id = String(result.sessionId)
      setSessionId(id)
      setSessionRunId(runId)
      beginPolling(id, runId)
    } catch (cause) { setRunning(false); setMessage(cause instanceof Error ? cause.message : 'Execution start failed') }
  }

  async function respond(decision: 'allow_once' | 'allow_session' | 'deny' | 'cancel'): Promise<void> {
    if (!window.harness || !sessionRunId || pendingApproval?.requestId === undefined) return
    if (decision === 'allow_once' && DANGEROUS.has(pendingApproval.category || '') && !confirmDangerous) {
      setConfirmDangerous(true); return
    }
    try {
      await window.harness.respondExecution(selectedProjectId, sessionRunId, sessionId, { requestId: pendingApproval.requestId, decision })
      setPendingApproval(undefined); setConfirmDangerous(false)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Approval response failed') }
  }

  async function cancel(): Promise<void> {
    if (!window.harness || !sessionId || !sessionRunId) return
    if (timer.current) clearInterval(timer.current)
    setRunning(false)
    try { await window.harness.cancelExecution(selectedProjectId, sessionRunId, sessionId) }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Cancel failed') }
  }

  return <section className="page">
    <header className="page-header"><h1>Codex Execution</h1><button className="button icon-button" onClick={() => void probe()} title="Probe Codex">R</button></header>
    {message && <div className="notice error">{message}</div>}
    <div className="panel toolbar">
      <span className={`badge ${capability?.available ? 'success' : 'danger'}`}>{capability?.available ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
      <strong>{capability?.version || 'Codex not detected'}</strong><span className="mono muted">{capability?.path}</span>
      {capability?.features?.includes('app-server') && <span className="badge success">APP SERVER</span>}
    </div>
    {!capability?.available && capability?.diagnostics && <div className="notice error">{capability.diagnostics}</div>}
    <div className="actions" style={{ margin: '14px 0' }}>
      <button className="button primary" disabled={running || !capability?.available || !activeRun} onClick={() => void start()}>&gt; Start</button>
      <button className="button danger" disabled={!running} onClick={() => void cancel()}>Stop</button>
      {activeRun && <span className="muted">{activeRun.current_node} as {activeRun.next_role}</span>}
      {sessionId && <span className="mono muted">{sessionId}</span>}
      {sessionRunId && <span className="mono muted">Run {sessionRunId}</span>}
    </div>
    {pendingApproval && <div className={`notice ${confirmDangerous ? 'error' : ''}`}>
      <strong>{confirmDangerous ? 'SECOND CONFIRMATION REQUIRED' : `${pendingApproval.category || 'external'} approval`}</strong>
      <div style={{ margin: '6px 0' }}>{pendingApproval.message}</div>
      <div className="actions">
        <button className="button primary" onClick={() => void respond('allow_once')}>{confirmDangerous ? 'Confirm allow' : 'Allow once'}</button>
        <button className="button" onClick={() => void respond('allow_session')}>Allow session</button>
        <button className="button danger" onClick={() => void respond('deny')}>Deny</button>
      </div>
    </div>}
    <div className="panel mono" style={{ minHeight: 360, maxHeight: 560, overflow: 'auto', padding: 14, background: '#17181a', color: '#e8eaed', fontSize: 12, lineHeight: 1.65 }}>
      {logs.length === 0 && <span style={{ color: '#9aa0a6' }}>No execution events.</span>}
      {logs.map((entry) => <div key={`${entry.type}:${entry.sequence}`}><span style={{ color: '#80868b' }}>{String(entry.sequence).padStart(3, '0')}</span> <strong>{entry.type}</strong> {entry.content || entry.error || entry.message || (entry.tool ? `${entry.tool} ${JSON.stringify(entry.params || {})}` : '')}</div>)}
      <div ref={logEnd} />
    </div>
  </section>
}

export function ExecutionPage(): React.ReactElement { return <ProjectRequired><ExecutionContent /></ProjectRequired> }
