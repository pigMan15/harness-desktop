import React, { useState } from 'react'
import { MapPin, RefreshCw, Trash2, Wrench } from 'lucide-react'
import type { ProjectSummary } from '../../app/harness-api'
import { useWorkspace } from '../layout/WorkspaceContext'
import { runProjectImport } from './project-import'
import { useLanguage } from '../settings/LanguageContext'

interface Notice {
  kind: 'info' | 'success' | 'error'
  message: string
}

function projectHealthHint(project: ProjectSummary): string {
  if (project.health === 'healthy') return 'Harness metadata is reachable and writable.'
  if (project.health === 'readonly') return 'Project is readable but not writable from the runtime.'
  if (project.health === 'degraded') return 'Harness metadata needs repair, relocation, or bootstrap refresh.'
  return 'Project health is unknown.'
}

export function ProjectsPage(): React.ReactElement {
  const { text } = useLanguage()
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

  async function maintain(action: 'repair' | 'relocate' | 'unregister', project: ProjectSummary): Promise<void> {
    if (!window.harness) return
    if (action === 'unregister' && !window.confirm(`Unregister ${project.name}? Project files will be kept.`)) return
    setNotice(undefined)
    try {
      const result = action === 'repair' ? await window.harness.repairProject(project.projectId)
        : action === 'relocate' ? await window.harness.relocateProject(project.projectId)
          : await window.harness.unregisterProject(project.projectId)
      if (result.error && result.error !== 'cancelled') throw new Error(String(result.error))
      await refreshProjects()
    } catch (cause) { setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : `${action} failed` }) }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Projects</h1>
        <div className="actions">
          <button className="button icon-button" onClick={() => void refreshProjects()} title={text('Refresh projects', '刷新项目')} aria-label={text('Refresh projects', '刷新项目')}><RefreshCw size={15} /></button>
          <button className="button primary" onClick={() => void importProject()} disabled={importing}>{importing ? text('Importing...', '正在导入...') : text('Import project', '导入项目')}</button>
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
                  <td><span className={`badge ${project.health === 'healthy' ? 'success' : 'warning'}`} title={projectHealthHint(project)}>{project.health}</span><div className="table-subtext">{projectHealthHint(project)}</div></td>
                  <td>v{project.protocolVersion}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {project.health !== 'healthy' && <button className="button icon-button" title={text('Repair project registration', '修复项目注册')} onClick={() => void maintain('repair', project)}><Wrench size={15} /></button>}
                      <button className="button icon-button" title={text('Relocate project', '重新定位项目')} onClick={() => void maintain('relocate', project)}><MapPin size={15} /></button>
                      <button className="button" disabled={selected} onClick={() => void choose(project)}>{selected ? text('Selected', '已选择') : text('Select', '选择')}</button>
                      <button className="button icon-button danger" title={text('Unregister project', '取消注册项目')} onClick={() => void maintain('unregister', project)}><Trash2 size={15} /></button>
                    </div>
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
