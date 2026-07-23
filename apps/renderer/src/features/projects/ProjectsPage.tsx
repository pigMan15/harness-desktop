import React, { useState } from 'react'
import type { ProjectSummary } from '../../app/harness-api'
import { useWorkspace } from '../layout/WorkspaceContext'
import { runProjectImport } from './project-import'

interface Notice {
  kind: 'info' | 'success' | 'error'
  message: string
}

export function ProjectsPage(): React.ReactElement {
  const { projects, selectedProjectId, loading, error, refreshProjects, selectProject } = useWorkspace()
  const [notice, setNotice] = useState<Notice>()
  const [importing, setImporting] = useState(false)

  async function importProject(): Promise<void> {
    if (!window.harness) return
    setImporting(true)
    setNotice(undefined)
    try {
      const result = await runProjectImport(window.harness.importProject, refreshProjects, selectProject)
      setNotice({
        kind: result.status === 'cancelled' ? 'info' : result.status,
        message: result.message,
      })
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  async function choose(project: ProjectSummary): Promise<void> {
    setNotice(undefined)
    try { await selectProject(project.projectId) }
    catch (cause) { setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : 'Selection failed' }) }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Projects</h1>
        <div className="actions">
          <button className="button icon-button" onClick={() => void refreshProjects()} title="Refresh projects" aria-label="Refresh projects">R</button>
          <button className="button primary" onClick={() => void importProject()} disabled={importing}>{importing ? 'Importing...' : 'Import project'}</button>
        </div>
      </header>
      {(notice || error) && <div className={`notice ${error || notice?.kind === 'error' ? 'error' : notice?.kind || ''}`}>{error || notice?.message}</div>}
      {loading && <div className="notice">Loading projects...</div>}
      {!loading && projects.length === 0 ? (
        <div className="panel empty-state"><h2>No projects</h2><p>Import a folder containing a valid .harness workspace.</p></div>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Path</th><th>Health</th><th>Protocol</th><th /></tr></thead>
            <tbody>{projects.map((project) => {
              const selected = project.projectId === selectedProjectId
              return (
                <tr key={project.projectId} className={selected ? 'selected' : ''}>
                  <td><strong>{project.name}</strong></td>
                  <td className="mono muted">{project.path}</td>
                  <td><span className={`badge ${project.health === 'healthy' ? 'success' : 'warning'}`}>{project.health}</span></td>
                  <td>v{project.protocolVersion}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="button" disabled={selected} onClick={() => void choose(project)}>{selected ? 'Selected' : 'Select'}</button>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
