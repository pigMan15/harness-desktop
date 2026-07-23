export interface ProjectDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface ProjectDialogOptions {
  title: string
  properties: Array<'openDirectory'>
}

interface ProjectImportDependencies<TWindow> {
  runtimeCall: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  showOpenDialog: (window: TWindow, options: ProjectDialogOptions) => Promise<ProjectDialogResult>
  getWindow: () => TWindow | null
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function createProjectImportHandler<TWindow>(dependencies: ProjectImportDependencies<TWindow>) {
  return async (_event: unknown, requestedPath: string): Promise<unknown> => {
    if (requestedPath && requestedPath !== '__dialog__' && requestedPath !== '.') {
      return dependencies.runtimeCall('project.import', { path: requestedPath })
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
      return dependencies.runtimeCall('project.import', { path: selectedPath })
    } catch (cause) {
      return { error: `Project selection failed: ${errorMessage(cause)}` }
    }
  }
}
