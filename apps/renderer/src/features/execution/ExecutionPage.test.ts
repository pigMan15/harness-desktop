import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ExecutionPage.tsx'), 'utf-8')

describe('ExecutionPage source contract', () => {
  it('lists all approval policy categories', () => {
    for (const category of ['file', 'command', 'network', 'external', 'deploy', 'delete', 'permission', 'dangerous_git']) {
      expect(source).toContain(`'${category}'`)
    }
  })

  it('requires a second confirmation for dangerous categories', () => {
    expect(source).toContain("new Set(['deploy','delete','dangerous_git'])")
    expect(source).toContain('SECOND CONFIRMATION REQUIRED')
  })

  it('uses the typed preload execution API', () => {
    expect(source).toContain('window.harness!.startExecution')
    expect(source).toContain('window.harness!.pollExecution')
    expect(source).toContain('window.harness!.respondExecution')
    expect(source).toContain('window.harness!.cancelExecution')
  })
})
