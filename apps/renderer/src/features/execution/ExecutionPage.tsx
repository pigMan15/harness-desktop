import React, { useState, useRef, useEffect, useCallback } from 'react'

interface LogEntry { type: string; sequence: number; content?: string; tool?: string; params?: any; message?: string; category?: string; data?: any; code?: number }

export function ExecutionPage(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [pendingApproval, setPendingApproval] = useState<LogEntry | null>(null)
  const [msg, setMsg] = useState('')
  const logEnd = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => { if (prev.find(e => e.sequence === entry.sequence && e.type === entry.type)) return prev; return [...prev, entry] })
  }, [])

  async function startExecution() {
    setLogs([]); setRunning(true); setMsg('Starting...'); setPendingApproval(null)
    try {
      const r = await window.harness!.startExecution('local', 'DEVELOPMENT', 'developer')
      if (r?.sessionId) {
        setSessionId(r.sessionId); setMsg('')
        pollEvents(r.sessionId)
      } else { addLog({ type: 'error', sequence: 0, content: r?.error || 'Failed to start' }); setRunning(false); setMsg('') }
    } catch (e: any) { addLog({ type: 'error', sequence: 0, content: e.message }); setRunning(false); setMsg('') }
  }

  function pollEvents(sid: string) {
    let stopped = false
    intervalRef.current = setInterval(async () => {
      if (stopped) return
      try {
        const events = await window.harness!.pollExecution(sid)
        if (Array.isArray(events) && events.length > 0) {
          for (const ev of events) {
            if (ev.type === 'approval_required') setPendingApproval(ev)
            if (ev.type === 'exited' || ev.type === 'error') {
              setRunning(false); stopped = true
              clearInterval(intervalRef.current)
            }
          }
          setLogs(prev => {
            const existing = new Set(prev.map(e => `${e.type}:${e.sequence}`))
            const newEvents = events.filter((e: any) => !existing.has(`${e.type}:${e.sequence}`))
            return [...prev, ...newEvents]
          })
        }
      } catch { /* network error during poll — keep trying */ }
    }, 500)
  }

  async function respond(decision: string) {
    try { await window.harness!.respondExecution(sessionId, { decision }); setPendingApproval(null) } catch { /* */ }
  }

  async function cancel() {
    try { await window.harness!.cancelExecution(sessionId); setRunning(false); clearInterval(intervalRef.current) } catch { /* */ }
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const TYPE_COLORS: Record<string, string> = { output: '#ccc', tool_call: '#64b5f6', approval_required: '#ffb74d', error: '#ef5350', exited: '#81c784' }

  return (
    <div style={{ padding: 24 }}>
      <h2>Execution</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', alignItems: 'center' }}>
        <button onClick={startExecution} disabled={running}
          style={{ padding: '8px 16px', background: running ? '#ccc' : '#4caf50', color: '#fff', border: 'none', borderRadius: 6, cursor: running ? 'default' : 'pointer' }}>
          Start (Fake)
        </button>
        <button onClick={cancel} disabled={!running}
          style={{ padding: '8px 16px', background: running ? '#f44336' : '#ccc', color: '#fff', border: 'none', borderRadius: 6, cursor: running ? 'pointer' : 'default' }}>
          Cancel
        </button>
        {sessionId && <span style={{ fontSize: 11, color: '#999' }}>Session: {sessionId}</span>}
        {msg && <span style={{ color: '#e65100' }}>{msg}</span>}
      </div>

      {pendingApproval && (
        <div style={{ padding: 12, margin: '8px 0', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8 }}>
          <strong>Approval Required</strong>
          <p style={{ margin: '4px 0' }}>{pendingApproval.message || pendingApproval.content || JSON.stringify(pendingApproval)}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => respond('allow_once')} style={{ padding: '6px 16px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Allow Once</button>
            <button onClick={() => respond('deny')} style={{ padding: '6px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Deny</button>
          </div>
        </div>
      )}

      <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>
        {logs.length === 0 && <span style={{ color: '#666' }}>Click Start to run a simulated execution with tool calls and approvals.</span>}
        {logs.map((e, i) => (
          <div key={i} style={{ color: TYPE_COLORS[e.type] || '#888' }}>
            <span style={{ color: '#555' }}>[{String(e.sequence).padStart(2, '0')}]</span>
            <span style={{ fontWeight: 500, marginLeft: 8 }}>{e.type}</span>
            {e.content && <span> {e.content}</span>}
            {e.tool && <span> tool={e.tool} params={JSON.stringify(e.params || {})}</span>}
            {e.message && <span> {e.message}</span>}
            {e.code !== undefined && <span> code={e.code}</span>}
          </div>
        ))}
        <div ref={logEnd} />
      </div>
    </div>
  )
}
