import React from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from '../features/layout/Sidebar'
import { RuntimeProvider, useRuntime } from '../features/layout/RuntimeContext'
import { WorkspaceProvider, useWorkspace } from '../features/layout/WorkspaceContext'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { RunsPage } from '../features/runs/RunsPage'
import { WorkflowPage } from '../features/workflow/WorkflowPage'
import { GatesPage } from '../features/gates/GatesPage'
import { ArtifactsPage } from '../features/artifacts/ArtifactsPage'
import { KnowledgePage } from '../features/knowledge/KnowledgePage'
import { ExecutionPage } from '../features/execution/ExecutionPage'
import { RecoveryPage } from '../features/recovery/RecoveryPage'

function WorkspaceHeader(): React.ReactElement {
  const { status } = useRuntime()
  const { selectedProject, activeRun } = useWorkspace()
  return (
    <header className="workspace-header">
      <div className="context-line">
        <span className="context-name">{selectedProject?.name || 'No project selected'}</span>
        {activeRun && <><span className="context-divider">/</span><span className="context-meta">{activeRun.run_id}</span></>}
      </div>
      <div className="context-line muted"><span className={`runtime-dot ${status === 'healthy' ? 'healthy' : ''}`} />Runtime {status}</div>
    </header>
  )
}

function WorkspaceRoutes(): React.ReactElement {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace-shell">
        <WorkspaceHeader />
        <main className="page-scroll">
          <Routes>
            <Route path="/" element={<Navigate to="/runs" replace />} />
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
    </div>
  )
}

export function App(): React.ReactElement {
  return (
    <RuntimeProvider>
      <WorkspaceProvider>
        <HashRouter><WorkspaceRoutes /></HashRouter>
      </WorkspaceProvider>
    </RuntimeProvider>
  )
}
