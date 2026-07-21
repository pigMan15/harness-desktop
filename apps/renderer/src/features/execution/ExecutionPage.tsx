import React, { useState, useRef, useEffect, useCallback } from 'react'

interface LogEntry { type: string; sequence: number; content?: string; tool?: string; params?: any; message?: string; category?: string; data?: any; code?: number }

export function ExecutionPage(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [pendingApproval, setPendingApproval] = useState<LogEntry | null>(null)
  const [msg, setMsg] = useState('')
  const logEnd = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runningRef = useRef(false)

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  async function startExecution() {
    setLogs([]); setRunning(true); setMsg('Starting...'); setPendingApproval(null)
    try {
      const r = await window.harness!.startExecution('local', 'DEVELOPMENT', 'developer')
      if (r?.sessionId) { setSessionId(r.sessionId); setMsg(''); startPolling(r.sessionId) }
      else { setRunning(false); setMsg(r?.error || 'Failed to start') }
    } catch (e: any) { setRunning(false); setMsg(e.message) }
  }

  function startPolling(sid: string) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    runningRef.current = true
    intervalRef.current = setInterval(async () => {
      if (!runningRef.current) { if (intervalRef.current) clearInterval(intervalRef.current); return }
      try {
        const events = await window.harness!.pollExecution(sid)
        if (Array.isArray(events) && events.length > 0) {
          setLogs(prev => {
            const existing = new Set(prev.map(e => `${e.type}:${e.sequence}`))
            const newEvents = events.filter((e: any) => !existing.has(`${e.type}:${e.sequence}`))
            for (const ev of newEvents) {
              if (ev.type === 'approval_required') setPendingApproval(ev)
              if (ev.type === 'exited' || ev.type === 'error') { setRunning(false); runningRef.current = false }
            }
            return [...prev, ...newEvents]
          })
        }
      } catch { /* keep polling */ }
    }, 500)
  }

  async function respond(decision: string) {
    try { await window.harness!.respondExecution(sessionId, { decision }); setPendingApproval(null) } catch { /* */ }
  }

  async function cancel() {
    runningRef.current = false; setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    try { await window.harness!.cancelExecution(sessionId) } catch { /* */ }
  }

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
