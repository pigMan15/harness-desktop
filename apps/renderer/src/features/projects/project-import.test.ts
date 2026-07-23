import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runProjectImport } from './project-import'

const project = {
  projectId: 'project-1',
  name: 'Harness Project',
  path: 'G:\\work\\project',
  protocolVersion: '1.0',
  health: 'healthy' as const,
}

describe('project import flow', () => {
  it('refreshes projects and selects the imported project before reporting success', async () => {
    const calls: string[] = []
    const importProject = vi.fn(async () => { calls.push('import'); return project })
    const refreshProjects = vi.fn(async () => { calls.push('refresh') })
    const selectProject = vi.fn(async () => { calls.push('select') })

    await expect(runProjectImport(importProject, refreshProjects, selectProject)).resolves.toEqual({
      status: 'success',
      project,
      message: 'Imported Harness Project',
    })
    expect(importProject).toHaveBeenCalledWith('__dialog__')
    expect(selectProject).toHaveBeenCalledWith('project-1')
    expect(calls).toEqual(['import', 'refresh', 'select'])
  })

  it('reports cancellation without refreshing or selecting', async () => {
    const refreshProjects = vi.fn()
    const selectProject = vi.fn()

    await expect(runProjectImport(
      vi.fn().mockResolvedValue({ error: 'cancelled' }),
      refreshProjects,
      selectProject,
    )).resolves.toEqual({ status: 'cancelled', message: 'Project import cancelled' })
    expect(refreshProjects).not.toHaveBeenCalled()
    expect(selectProject).not.toHaveBeenCalled()
  })

  it('preserves Runtime errors and converts thrown values into visible errors', async () => {
    const refreshProjects = vi.fn()
    const selectProject = vi.fn()

    await expect(runProjectImport(
      vi.fn().mockResolvedValue({ error: 'No .harness directory found' }),
      refreshProjects,
      selectProject,
    )).resolves.toEqual({ status: 'error', message: 'No .harness directory found' })
    await expect(runProjectImport(
      vi.fn().mockRejectedValue(new Error('IPC unavailable')),
      refreshProjects,
      selectProject,
    )).resolves.toEqual({ status: 'error', message: 'IPC unavailable' })
    expect(refreshProjects).not.toHaveBeenCalled()
    expect(selectProject).not.toHaveBeenCalled()
  })

  it('connects the flow to visible progress and notice states in ProjectsPage', () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ProjectsPage.tsx'), 'utf-8')
    expect(source).toContain('runProjectImport(window.harness.importProject, refreshProjects, selectProject)')
    expect(source).toContain("importing ? 'Importing...' : 'Import project'")
    expect(source).toContain("notice?.kind")
  })
})
