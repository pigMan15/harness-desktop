import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectSummary, RunSummary, TerminalEvent, TerminalSessionSummary } from '../../app/harness-api'
import { useRuntime } from './RuntimeContext'

interface WorkspaceContextValue {
  projects: ProjectSummary[]
  selectedProjectId: string
  selectedProject?: ProjectSummary
  selectedRunId: string
  selectedRun?: RunSummary
  activeRun?: RunSummary
  runsById: Record<string, RunSummary>
  terminalSessionsById: Record<string, TerminalSessionSummary>
  revision: string
  loading: boolean
  error: string
  refreshProjects: () => Promise<void>
  refreshRuns: () => Promise<void>
  refreshTerminals: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
  selectRun: (runId: string) => Promise<void>
  updateActiveRun: (run: RunSummary | undefined, revision?: string) => void
}

const STORAGE_KEY = 'harness.selectedProjectId'
const RUN_STORAGE_PREFIX = 'harness.selectedRunId.'
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { ready } = useRuntime()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) || '',
  )
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runsById, setRunsById] = useState<Record<string, RunSummary>>({})
  const [terminalSessionsById, setTerminalSessionsById] = useState<Record<string, TerminalSessionSummary>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const runSelections = useRef(new Map<string, Promise<void>>())

  const loadRuns = useCallback(async (projectId: string) => {
    if (!window.harness || !projectId) return
    const result = await window.harness.listRuns(projectId)
    if (!Array.isArray(result)) throw new Error(result.error)
    const normalized = Object.fromEntries(result.map((run) => [run.run_id, run]))
    setRunsById(normalized)
    const remembered = window.localStorage.getItem(`${RUN_STORAGE_PREFIX}${projectId}`) || ''
    const next = normalized[remembered] ? remembered : (result.find((run) => run.active)?.run_id || result[0]?.run_id || '')
    setSelectedRunId(next)
    if (next) window.localStorage.setItem(`${RUN_STORAGE_PREFIX}${projectId}`, next)
  }, [])

  const loadTerminals = useCallback(async (projectId: string) => {
    if (!window.harness || !projectId) return
    const result = await window.harness.listTerminals(projectId)
    setTerminalSessionsById(Object.fromEntries(result.map((session) => [session.sessionId, session])))
  }, [])

  const refreshRuns = useCallback(async () => {
    if (!selectedProjectId) return
    await loadRuns(selectedProjectId)
  }, [loadRuns, selectedProjectId])

  const refreshTerminals = useCallback(async () => {
    if (!selectedProjectId) return
    await loadTerminals(selectedProjectId)
  }, [loadTerminals, selectedProjectId])

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
        setSelectedRunId('')
        setRunsById({})
        setTerminalSessionsById({})
      } else if (selectedProjectId) {
        await Promise.all([loadRuns(selectedProjectId), loadTerminals(selectedProjectId)])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [loadRuns, loadTerminals, selectedProjectId])

  useEffect(() => { if (ready) void refreshProjects() }, [ready, refreshProjects])

  useEffect(() => {
    if (!window.harness) return
    const update = (session: TerminalEvent) => {
      setTerminalSessionsById((current) => {
        const existing = current[session.sessionId]
        return existing ? { ...current, [session.sessionId]: { ...existing, ...session } } : current
      })
    }
    const offStatus = window.harness.onTerminalStatus(update)
    const offExit = window.harness.onTerminalExit(update)
    const offData = window.harness.onTerminalData((event) => {
      setTerminalSessionsById((current) => {
        const session = current[event.sessionId]
        return session ? { ...current, [event.sessionId]: { ...session, sequence: event.sequence } } : current
      })
    })
    return () => { offStatus(); offExit(); offData() }
  }, [])

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    window.localStorage.setItem(STORAGE_KEY, projectId)
    setSelectedRunId('')
    setRunsById({})
    setTerminalSessionsById({})
    await Promise.all([loadRuns(projectId), loadTerminals(projectId)])
  }, [loadRuns, loadTerminals])

  const selectRun = useCallback(async (runId: string) => {
    if (!window.harness) return
    const pending = runSelections.current.get(runId)
    if (pending) return pending
    const selection = (async () => {
      let selected: RunSummary | undefined = runsById[runId]
      if (!selected) {
        const listed = await window.harness!.listRuns(selectedProjectId)
        if (!Array.isArray(listed)) throw new Error(listed.error)
        selected = listed.find((run) => run.run_id === runId)
        if (!selected) throw new Error(`Run not found: ${runId}`)
        setRunsById(Object.fromEntries(listed.map((run) => [run.run_id, run])))
      }
      const result = await window.harness!.switchRun(selectedProjectId, runId, selected.revision)
      if (result.error) throw new Error(String(result.error))
      // 同一 Run 的并发选择共享一个权威切换，避免旧 revision 的重复请求阻断后续导航。
      setRunsById((current) => Object.fromEntries(Object.entries(current).map(([id, run]) => [id, {
        ...run,
        active: id === runId,
        revision: id === runId ? String(result.revision || run.revision) : run.revision,
      }])))
      setSelectedRunId(runId)
      window.localStorage.setItem(`${RUN_STORAGE_PREFIX}${selectedProjectId}`, runId)
    })()
    runSelections.current.set(runId, selection)
    try {
      await selection
    } finally {
      if (runSelections.current.get(runId) === selection) runSelections.current.delete(runId)
    }
  }, [runsById, selectedProjectId])

  const updateActiveRun = useCallback((run: RunSummary | undefined, nextRevision = '') => {
    if (!run) return
    const updated = nextRevision ? { ...run, revision: nextRevision } : run
    setRunsById((current) => ({ ...current, [updated.run_id]: updated }))
    setSelectedRunId(updated.run_id)
    if (selectedProjectId) window.localStorage.setItem(`${RUN_STORAGE_PREFIX}${selectedProjectId}`, updated.run_id)
  }, [selectedProjectId])

  const selectedRun = runsById[selectedRunId]
  const value = useMemo<WorkspaceContextValue>(() => ({
    projects,
    selectedProjectId,
    selectedProject: projects.find((project) => project.projectId === selectedProjectId),
    selectedRunId,
    selectedRun,
    activeRun: selectedRun,
    runsById,
    terminalSessionsById,
    revision: selectedRun?.revision || '',
    loading,
    error,
    refreshProjects,
    refreshRuns,
    refreshTerminals,
    selectProject,
    selectRun,
    updateActiveRun,
  }), [projects, selectedProjectId, selectedRunId, selectedRun, runsById, terminalSessionsById, loading, error, refreshProjects, refreshRuns, refreshTerminals, selectProject, selectRun, updateActiveRun])

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
    return <section className="empty-state"><h2>Select a project</h2><p>Open Projects to import or select a Harness workspace.</p></section>
  }
  return <>{children}</>
}
