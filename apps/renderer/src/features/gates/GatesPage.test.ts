import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'GatesDashboard.tsx'), 'utf8')
const styles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'gates.css'), 'utf8')

describe('Gates quality decision center', () => {
  it('provides overview, ordered batch evaluation, evidence, and recovery details', () => {
    expect(source).toContain('gate-overview')
    expect(source).toContain('evaluatePending')
    expect(source).toContain('for (const id of ids)')
    expect(source).toContain("value.status === 'FAIL' || value.status === 'BLOCKED'")
    expect(source).toContain('listArtifacts')
    expect(source).toContain('openArtifact')
    expect(source).toContain('Recovery guidance')
    expect(source).toContain('VERIFIER_ONLY')
    expect(source).toContain('canWaive')
  })
  it('uses grouped cards, timeline, and a detail drawer', () => {
    expect(source).toContain('gate-card-grid')
    expect(source).toContain('gate-timeline')
    expect(source).toContain('gate-drawer-backdrop')
    expect(styles).toContain('.gate-overview')
    expect(styles).toContain('.gate-drawer')
  })
})
