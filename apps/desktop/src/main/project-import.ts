export interface ProjectDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface ProjectDialogOptions {
  title: string
  properties: Array<'openDirectory'>
}

export interface ProjectConfirmationResult {
  response: number
}

export interface ProjectConfirmationOptions {
  type: 'question'
  title: string
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
  noLink: boolean
}

interface ProjectImportConfirmation {
  confirmationRequired: true
  action: 'initialize' | 'append'
  path?: string
  missingFiles: string[]
  missingCount: number
}

interface ProjectImportDependencies<TWindow> {
  runtimeCall: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  showOpenDialog: (window: TWindow, options: ProjectDialogOptions) => Promise<ProjectDialogResult>
  showMessageBox?: (window: TWindow, options: ProjectConfirmationOptions) => Promise<ProjectConfirmationResult>
  getWindow: () => TWindow | null
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function isConfirmation(result: unknown): result is ProjectImportConfirmation {
  if (!result || typeof result !== 'object') return false
  const candidate = result as Partial<ProjectImportConfirmation>
  return candidate.confirmationRequired === true
    && (candidate.action === 'initialize' || candidate.action === 'append')
    && Array.isArray(candidate.missingFiles)
}

function confirmationOptions(result: ProjectImportConfirmation): ProjectConfirmationOptions {
  const initialize = result.action === 'initialize'
  const preview = result.missingFiles.slice(0, 8)
  const remaining = Math.max(0, result.missingCount - preview.length)
  const summary = preview.length > 0 ? preview.join('\n') : 'Harness v1 files'
  const suffix = remaining > 0 ? `\n... and ${remaining} more` : ''
  return {
    type: 'question',
    title: initialize ? 'Initialize Harness project' : 'Complete Harness project',
    message: initialize
      ? 'This folder does not contain .harness. Initialize it with the bundled Harness v1 template?'
      : 'This Harness project is missing files. Append the missing v1 template files?',
    detail: `${result.missingCount} file(s) will be created. Existing files will not be changed.\n\n${summary}${suffix}`,
    buttons: initialize ? ['Initialize', 'Cancel'] : ['Append missing files', 'Skip'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  }
}

export function createProjectImportHandler<TWindow>(dependencies: ProjectImportDependencies<TWindow>) {
  async function importPath(path: string): Promise<unknown> {
    const firstResult = await dependencies.runtimeCall('project.import', { path })
    if (!isConfirmation(firstResult)) return firstResult

    const window = dependencies.getWindow()
    if (!window) return { error: 'No window available for project confirmation' }
    if (!dependencies.showMessageBox) return { error: 'Project confirmation dialog unavailable' }

    const confirmation = await dependencies.showMessageBox(window, confirmationOptions(firstResult))
    if (confirmation.response !== 0) {
      if (firstResult.action === 'initialize') return { error: 'cancelled' }
      // 追加被拒绝时只注册当前状态，Runtime 仍负责判断 healthy/degraded。
      return dependencies.runtimeCall('project.import', { path: firstResult.path || path, decision: 'skip' })
    }
    return dependencies.runtimeCall('project.import', {
      path: firstResult.path || path,
      decision: firstResult.action,
    })
  }

  return async (_event: unknown, requestedPath: string): Promise<unknown> => {
    if (requestedPath && requestedPath !== '__dialog__' && requestedPath !== '.') {
      return importPath(requestedPath)
    }

    const window = dependencies.getWindow()
    if (!window) return { error: 'No window available for project selection' }

    try {
      const result = await dependencies.showOpenDialog(window, {
        title: 'Import .harness Project',
        properties: ['openDirectory'],
      })
      if (result.canceled) return { error: 'cancelled' }
      const selectedPath = result.filePaths[0]
      if (!selectedPath) return { error: 'No project directory selected' }
      return importPath(selectedPath)
    } catch (cause) {
      return { error: `Project selection failed: ${errorMessage(cause)}` }
    }
  }
}
