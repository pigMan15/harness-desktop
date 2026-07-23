import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ExecutionPage.tsx'), 'utf-8')

describe('ExecutionPage source contract', () => {
  it('uses the real Codex probe and has no Fake entry', () => {
    expect(source).toContain('window.harness.probeExecution(selectedProjectId)')
    expect(source).toContain("features?.includes('app-server')")
    expect(source).not.toContain('Start (Fake)')
  })

  it('requires a second confirmation for dangerous categories', () => {
    expect(source).toContain("new Set(['deploy','delete','dangerous_git'])")
    expect(source).toContain('SECOND CONFIRMATION REQUIRED')
  })

  it('uses the typed preload execution API', () => {
    expect(source).toContain('window.harness.startExecution(selectedProjectId, runId, revision')
    expect(source).toContain('window.harness.pollExecution(selectedProjectId, runId, id)')
    expect(source).toContain('window.harness.respondExecution(selectedProjectId, sessionRunId, sessionId')
    expect(source).toContain('window.harness.cancelExecution(selectedProjectId, sessionRunId, sessionId)')
    expect(source).toContain('setSessionRunId(runId)')
  })
})
