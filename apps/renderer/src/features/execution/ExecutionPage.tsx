import React, { useState, useRef, useEffect } from 'react'

interface LogEntry { type: string; sequence: number; content?: string; tool?: string; message?: string; category?: string; data?: any }

export function ExecutionPage(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [pendingApproval, setPendingApproval] = useState<LogEntry | null>(null)
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  async function startExecution() {
    setLogs([]); setRunning(true); setPendingApproval(null)
    try {
      const result = await window.harness!.startExecution('local', 'DEVELOPMENT', 'developer')
      if (result?.sessionId) {
        setSessionId(result.sessionId)
        pollEvents(result.sessionId)
      } else {
        addLog({ type: 'error', sequence: 0, content: 'Failed to start: ' + (result?.error || 'unknown') })
        setRunning(false)
      }
    } catch (e: any) { addLog({ type: 'error', sequence: 0, content: e.message }); setRunning(false) }
  }

  async function pollEvents(sid: string) {
    const interval = setInterval(async () => {
      try {
        const events = await window.harness!.pollExecution(sid)
        if (Array.isArray(events)) {
          for (const ev of events) {
            addLog(ev)
            if (ev.type === 'approval_required') setPendingApproval(ev)
            if (ev.type === 'exited' || ev.type === 'error') { setRunning(false); clearInterval(interval) }
          }
        }
      } catch { setRunning(false); clearInterval(interval) }
    }, 500)
  }

  function addLog(entry: LogEntry) {
    setLogs(prev => { const exists = prev.find(e => e.sequence === entry.sequence && e.type === entry.type); return exists ? prev : [...prev, entry] })
  }

  async function handleApprove() {
    try { await window.harness!.respondExecution(sessionId, { decision: 'allow_once' }); setPendingApproval(null) } catch { /* */ }
  }
  async function handleDeny() {
    try { await window.harness!.respondExecution(sessionId, { decision: 'deny' }); setPendingApproval(null) } catch { /* */ }
  }
  async function handleCancel() {
    try { await window.harness!.cancelExecution(sessionId); setRunning(false) } catch { /* */ }
  }

  const TYPE_COLORS: Record<string, string> = {
    output: '#333', tool_call: '#1565c0', approval_required: '#e65100', error: '#c62828', exited: '#2e7d32',
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Execution</h2>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={startExecution} disabled={running}
          style={{ padding: '8px 16px', background: running ? '#ccc' : '#4caf50', color: '#fff', border: 'none', borderRadius: 6, cursor: running ? 'default' : 'pointer' }}>
          ▶ Start (Fake Executor)
        </button>
        <button onClick={handleCancel} disabled={!running}
          style={{ padding: '8px 16px', background: running ? '#f44336' : '#ccc', color: '#fff', border: 'none', borderRadius: 6, cursor: running ? 'pointer' : 'default' }}>
          ⏹ Cancel
        </button>
        {sessionId && <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>Session: {sessionId}</span>}
      </div>

      {pendingApproval && (
        <div style={{ padding: 12, margin: '8px 0', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8 }}>
          <strong>⚠ Approval Required</strong>
          <p>{pendingApproval.message || pendingApproval.data?.message}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleApprove} style={{ padding: '6px 16px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Allow Once</button>
            <button onClick={handleDeny} style={{ padding: '6px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Deny</button>
          </div>
        </div>
      )}

      <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', fontFamily: 'monospace', fontSize: 13 }}>
        {logs.map((e, i) => (
          <div key={i} style={{ padding: '2px 0', color: TYPE_COLORS[e.type] || '#888' }}>
            <span style={{ color: '#666', marginRight: 8 }}>[{e.sequence}]</span>
            <span style={{ fontWeight: 500 }}>{e.type}</span>
            {' '}{e.content || e.tool || e.message || JSON.stringify(e.data || '')}
          </div>
        ))}
        {logs.length === 0 && <span style={{ color: '#666' }}>Click Start to run a simulated execution...</span>}
        <div ref={logEnd} />
      </div>
    </div>
  )
}
