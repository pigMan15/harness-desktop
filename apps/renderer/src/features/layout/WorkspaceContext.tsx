import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSummary, RunSummary } from '../../app/harness-api'
import { useRuntime } from './RuntimeContext'

interface WorkspaceContextValue {
  projects: ProjectSummary[]
  selectedProjectId: string
  selectedProject?: ProjectSummary
  activeRun?: RunSummary
  revision: string
  loading: boolean
  error: string
  refreshProjects: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  updateActiveRun: (run: RunSummary | undefined, revision?: string) => void
}

const STORAGE_KEY = 'harness.selectedProjectId'
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { ready } = useRuntime()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) || '',
  )
  const [activeRun, setActiveRun] = useState<RunSummary>()
  const [revision, setRevision] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadActiveRun = useCallback(async (projectId: string) => {
    if (!window.harness || !projectId) return
    const result = await window.harness.listRuns(projectId)
    if (Array.isArray(result)) {
      const selected = result.find((run) => run.active)
      setActiveRun(selected)
      setRevision(selected?.revision || '')
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    if (!window.harness) return
    setLoading(true)
    setError('')
    try {
      const result = await window.harness.listProjects()
      if (!Array.isArray(result)) throw new Error(result.error)
      setProjects(result)
      if (selectedProjectId && !result.some((project) => project.projectId === selectedProjectId)) {
        window.localStorage.removeItem(STORAGE_KEY)
        setSelectedProjectId('')
        setActiveRun(undefined)
      } else if (selectedProjectId) {
        await loadActiveRun(selectedProjectId)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [loadActiveRun, selectedProjectId])

  useEffect(() => {
    if (ready) void refreshProjects()
  }, [ready, refreshProjects])

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    window.localStorage.setItem(STORAGE_KEY, projectId)
    setActiveRun(undefined)
    setRevision('')
    await loadActiveRun(projectId)
  }, [loadActiveRun])

  const updateActiveRun = useCallback((run: RunSummary | undefined, nextRevision = '') => {
    setActiveRun(run)
    if (nextRevision) setRevision(nextRevision)
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => ({
    projects,
    selectedProjectId,
    selectedProject: projects.find((project) => project.projectId === selectedProjectId),
    activeRun,
    revision,
    loading,
    error,
    refreshProjects,
    selectProject,
    updateActiveRun,
  }), [projects, selectedProjectId, activeRun, revision, loading, error, refreshProjects, selectProject, updateActiveRun])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return context
}

export function ProjectRequired({ children }: { children: React.ReactNode }): React.ReactElement {
  const { selectedProjectId } = useWorkspace()
  if (!selectedProjectId) {
    return (
      <section className="empty-state">
        <h2>Select a project</h2>
        <p>Open Projects to import or select a Harness workspace.</p>
      </section>
    )
  }
  return <>{children}</>
}
