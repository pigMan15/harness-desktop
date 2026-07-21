import React, { useCallback, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from '../features/layout/Sidebar'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { RunsPage } from '../features/runs/RunsPage'
import { WorkflowPage } from '../features/workflow/WorkflowPage'
import { GatesPage } from '../features/gates/GatesPage'
import { ArtifactsPage } from '../features/artifacts/ArtifactsPage'
import { KnowledgePage } from '../features/knowledge/KnowledgePage'
import { ExecutionPage } from '../features/execution/ExecutionPage'
import { RecoveryPage } from '../features/recovery/RecoveryPage'

declare global {
  interface Window {
    harness?: {
      health: () => Promise<any>
      listProjects: () => Promise<any>
      importProject: (path: string) => Promise<any>
      validateProject: (path: string) => Promise<any>
      listRuns: (projectId: string) => Promise<any>
      createRun: (projectId: string, intent: string, risk: string, runId: string) => Promise<any>
      getWorkflow: (projectId: string) => Promise<any>
      compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<any>
      listGates: (projectId: string) => Promise<any>
      evaluateGate: (gateId: string, status: string) => Promise<any>
      listArtifacts: (projectId: string) => Promise<any>
      readArtifact: (projectId: string, filename: string) => Promise<any>
      listKnowledge: (projectId: string, status: string) => Promise<any>
      reviewKnowledge: (candidateId: number, decision: string) => Promise<any>
      startExecution: (projectId: string, nodeId: string, role: string) => Promise<any>
      pollExecution: (sessionId: string) => Promise<any>
      respondExecution: (sessionId: string, decision: any) => Promise<any>
      cancelExecution: (sessionId: string) => Promise<any>
      scanRecovery: (projectId: string) => Promise<any>
      cleanupRecovery: (projectId: string) => Promise<any>
      onRuntimeEvent: (channel: string, cb: (...args: any[]) => void) => void
    }
  }
}

type RuntimeStatus = 'connecting' | 'healthy' | 'unavailable'

function HomePage({ status, versionInfo, errorMessage }: {
  status: RuntimeStatus; versionInfo: any; errorMessage: string | null
}): React.ReactElement {
  const config: Record<RuntimeStatus, { label: string; color: string; bg: string }> = {
    connecting: { label: 'Connecting…', color: '#856404', bg: '#fff3cd' },
    healthy: { label: 'Runtime healthy ✓', color: '#155724', bg: '#d4edda' },
    unavailable: { label: 'Runtime unavailable ✗', color: '#721c24', bg: '#f8d7da' },
  }
  const c = config[status]
  return (
    <div style={{ padding: 24 }}>
      <h2>Harness Desktop</h2>
      <div style={{ marginTop: 16 }}>
        <span style={{ padding: '4px 12px', borderRadius: 4, color: c.color, background: c.bg, fontWeight: 500 }}>
          {c.label}
        </span>
      </div>
      {errorMessage && <p style={{ marginTop: 12, color: '#721c24' }}>{errorMessage}</p>}
      {status === 'healthy' && (
        <div style={{ marginTop: 12 }}>
          <p>Runtime: {versionInfo.runtime ?? 'unknown'}</p>
          <p>Protocol: v{versionInfo.protocol ?? 'unknown'}</p>
        </div>
      )}
    </div>
  )
}

export function App(): React.ReactElement {
  const [status, setStatus] = useState<RuntimeStatus>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [versionInfo, setVersionInfo] = useState<{ runtime?: string; protocol?: string }>({})

  const checkHealth = useCallback(async () => {
    if (!window.harness) { setStatus('unavailable'); return }
    for (let i = 0; i < 10; i++) {
      try {
        const result = await window.harness.health()
        if (result?.status === 'healthy') {
          setStatus('healthy')
          setVersionInfo({ runtime: result.runtime_version, protocol: result.protocol_version })
          return
        }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 1000))
    }
    setStatus('unavailable')
    setErrorMessage('Runtime did not start')
  }, [])

  useEffect(() => {
    if (!window.harness) return
    window.harness.onRuntimeEvent('runtime:status', (data: any) => {
      setStatus(data?.healthy ? 'healthy' : 'unavailable')
    })
    window.harness.onRuntimeEvent('runtime:error', (data: any) => {
      setStatus('unavailable')
      setErrorMessage(data?.message ?? 'Runtime error')
    })
    checkHealth()
  }, [checkHealth])

  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<HomePage status={status} versionInfo={versionInfo} errorMessage={errorMessage} />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/workflow" element={<WorkflowPage />} />
            <Route path="/gates" element={<GatesPage />} />
            <Route path="/artifacts" element={<ArtifactsPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
