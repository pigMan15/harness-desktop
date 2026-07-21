import React from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from '../features/layout/Sidebar'
import { RuntimeProvider, useRuntime } from '../features/layout/RuntimeContext'
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
      health: () => Promise<any>; listProjects: () => Promise<any>
      importProject: (path: string) => Promise<any>; validateProject: (path: string) => Promise<any>
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

function HomePage(): React.ReactElement {
  const { status, version } = useRuntime()
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    connecting: { label: 'Connecting...', bg: '#fff3cd', color: '#856404' },
    healthy: { label: 'Runtime healthy', bg: '#d4edda', color: '#155724' },
    unavailable: { label: 'Runtime unavailable', bg: '#f8d7da', color: '#721c24' },
    timeout: { label: 'Runtime timeout', bg: '#f8d7da', color: '#721c24' },
  }
  const c = cfg[status] || cfg.connecting
  return (
    <div style={{ padding: 24 }}>
      <h2>Harness Desktop</h2>
      <p style={{ padding: '6px 14px', borderRadius: 6, background: c.bg, color: c.color, fontWeight: 500, display: 'inline-block', marginTop: 8 }}>
        {c.label}
      </p>
      {status === 'healthy' && version?.runtime && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
          <p>Runtime: {version.runtime}</p>
          <p>Protocol: v{version.protocol}</p>
        </div>
      )}
      {status === 'unavailable' && <p style={{ marginTop: 12, color: '#721c24' }}>Check that the Runtime is installed and accessible.</p>}
    </div>
  )
}

export function App(): React.ReactElement {
  return (
    <RuntimeProvider>
      <HashRouter>
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
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
    </RuntimeProvider>
  )
}
