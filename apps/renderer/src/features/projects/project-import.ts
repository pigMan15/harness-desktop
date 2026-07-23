import type { ProjectSummary } from '../../app/harness-api'

type ImportProject = (path: string) => Promise<ProjectSummary | { error: string }>
type RefreshProjects = () => Promise<void>
type SelectProject = (projectId: string) => Promise<void>

export type ProjectImportOutcome =
  | { status: 'success'; project: ProjectSummary; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string }

export async function runProjectImport(
  importProject: ImportProject,
  refreshProjects: RefreshProjects,
  selectProject: SelectProject,
): Promise<ProjectImportOutcome> {
  try {
    const result = await importProject('__dialog__')
    if ('error' in result) {
      return result.error === 'cancelled'
        ? { status: 'cancelled', message: 'Project import cancelled' }
        : { status: 'error', message: result.error }
    }

    await refreshProjects()
    await selectProject(result.projectId)
    return { status: 'success', project: result, message: `Imported ${result.name}` }
  } catch (cause) {
    return {
      status: 'error',
      message: cause instanceof Error ? cause.message : 'Project import failed',
    }
  }
}
