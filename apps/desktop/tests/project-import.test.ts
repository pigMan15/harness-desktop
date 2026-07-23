import { describe, expect, it, vi } from 'vitest'
import { createProjectImportHandler } from '../src/main/project-import'

describe('project import IPC handler', () => {
  const showMessageBox = vi.fn()

  it('imports an explicit path without requiring a window or opening a dialog', async () => {
    const runtimeCall = vi.fn().mockResolvedValue({ projectId: 'project-1' })
    const showOpenDialog = vi.fn()
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog,
      getWindow: () => null,
    })

    await expect(handler(undefined, 'G:\\work\\project')).resolves.toEqual({ projectId: 'project-1' })
    expect(showOpenDialog).not.toHaveBeenCalled()
    expect(runtimeCall).toHaveBeenCalledWith('project.import', { path: 'G:\\work\\project' })
  })

  it('opens a directory dialog and imports the selected absolute path', async () => {
    const window = { id: 1 }
    const runtimeCall = vi.fn().mockResolvedValue({ projectId: 'project-2' })
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['G:\\work\\selected'] })
    const handler = createProjectImportHandler({ runtimeCall, showOpenDialog, getWindow: () => window })

    await expect(handler(undefined, '__dialog__')).resolves.toEqual({ projectId: 'project-2' })
    expect(showOpenDialog).toHaveBeenCalledWith(window, {
      title: 'Import .harness Project',
      properties: ['openDirectory'],
    })
    expect(runtimeCall).toHaveBeenCalledWith('project.import', { path: 'G:\\work\\selected' })
  })

  it('returns cancelled without calling Runtime when the dialog is cancelled', async () => {
    const runtimeCall = vi.fn()
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      getWindow: () => ({ id: 1 }),
    })

    await expect(handler(undefined, '__dialog__')).resolves.toEqual({ error: 'cancelled' })
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('returns an actionable error when no window can own the dialog', async () => {
    const runtimeCall = vi.fn()
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn(),
      getWindow: () => null,
    })

    await expect(handler(undefined, '__dialog__')).resolves.toEqual({ error: 'No window available for project selection' })
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('converts dialog failures and empty selections into structured errors', async () => {
    const runtimeCall = vi.fn()
    const failedHandler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn().mockRejectedValue(new Error('access denied')),
      getWindow: () => ({ id: 1 }),
    })
    const emptyHandler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
      getWindow: () => ({ id: 1 }),
    })

    await expect(failedHandler(undefined, '__dialog__')).resolves.toEqual({ error: 'Project selection failed: access denied' })
    await expect(emptyHandler(undefined, '__dialog__')).resolves.toEqual({ error: 'No project directory selected' })
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('confirms initialization before Runtime writes a project without .harness', async () => {
    const runtimeCall = vi.fn()
      .mockResolvedValueOnce({
        confirmationRequired: true,
        action: 'initialize',
        missingFiles: ['workflow.yaml'],
        missingCount: 1,
      })
      .mockResolvedValueOnce({ projectId: 'project-3' })
    showMessageBox.mockResolvedValueOnce({ response: 0 })
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn(),
      showMessageBox,
      getWindow: () => ({ id: 1 }),
    })

    await expect(handler(undefined, 'G:\\work\\plain')).resolves.toEqual({ projectId: 'project-3' })
    expect(showMessageBox).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({
      title: 'Initialize Harness project',
      buttons: ['Initialize', 'Cancel'],
    }))
    expect(runtimeCall).toHaveBeenNthCalledWith(2, 'project.import', {
      path: 'G:\\work\\plain',
      decision: 'initialize',
    })
  })

  it('cancels initialization without issuing a second Runtime call', async () => {
    const runtimeCall = vi.fn().mockResolvedValue({
      confirmationRequired: true,
      action: 'initialize',
      missingFiles: ['workflow.yaml'],
      missingCount: 1,
    })
    showMessageBox.mockResolvedValueOnce({ response: 1 })
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn(),
      showMessageBox,
      getWindow: () => ({ id: 1 }),
    })

    await expect(handler(undefined, 'G:\\work\\plain')).resolves.toEqual({ error: 'cancelled' })
    expect(runtimeCall).toHaveBeenCalledTimes(1)
  })

  it('declines append by importing with the skip decision', async () => {
    const runtimeCall = vi.fn()
      .mockResolvedValueOnce({
        confirmationRequired: true,
        action: 'append',
        missingFiles: ['rules/safety.md'],
        missingCount: 1,
      })
      .mockResolvedValueOnce({ projectId: 'project-4', health: 'degraded' })
    showMessageBox.mockResolvedValueOnce({ response: 1 })
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn(),
      showMessageBox,
      getWindow: () => ({ id: 1 }),
    })

    await expect(handler(undefined, 'G:\\work\\partial')).resolves.toEqual({ projectId: 'project-4', health: 'degraded' })
    expect(runtimeCall).toHaveBeenNthCalledWith(2, 'project.import', {
      path: 'G:\\work\\partial',
      decision: 'skip',
    })
  })

  it('reports a missing confirmation window without issuing a decision', async () => {
    const runtimeCall = vi.fn().mockResolvedValue({
      confirmationRequired: true,
      action: 'initialize',
      missingFiles: ['workflow.yaml'],
      missingCount: 1,
    })
    const handler = createProjectImportHandler({
      runtimeCall,
      showOpenDialog: vi.fn(),
      showMessageBox,
      getWindow: () => null,
    })

    await expect(handler(undefined, 'G:\\work\\plain')).resolves.toEqual({
      error: 'No window available for project confirmation',
    })
    expect(runtimeCall).toHaveBeenCalledTimes(1)
  })
})
