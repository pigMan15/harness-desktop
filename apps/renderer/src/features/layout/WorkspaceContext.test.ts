import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('workspace project context source contract', () => {
  it('persists explicit selection and removes hard-coded local project ids', () => {
    const workspace = readFileSync(resolve('src/features/layout/WorkspaceContext.tsx'), 'utf-8')
    expect(workspace).toContain("window.localStorage.setItem(STORAGE_KEY, projectId)")

    for (const file of ['RunsPage.tsx', '../workflow/WorkflowPage.tsx', '../gates/GatesPage.tsx', '../execution/ExecutionPage.tsx']) {
      const path = file.startsWith('..') ? resolve('src/features/layout', file) : resolve('src/features/runs', file)
      expect(readFileSync(path, 'utf-8')).not.toContain("'local'")
    }
  })

  it('uses server workflow preview and deterministic gate evaluation', () => {
    const workflow = readFileSync(resolve('src/features/workflow/WorkflowPage.tsx'), 'utf-8')
    const gates = readFileSync(resolve('src/features/gates/GatesPage.tsx'), 'utf-8')
    expect(workflow).toContain('previewWorkflow(')
    expect(workflow).toContain('preview.base_hash')
    expect(gates).toContain('evaluateGate(selectedProjectId, context.runId, gateId, context.revision)')
    expect(gates).not.toContain("['PASS', 'FAIL'")
  })
})
