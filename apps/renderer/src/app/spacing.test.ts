import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = dirname(fileURLToPath(import.meta.url))
const theme = readFileSync(resolve(appDirectory, 'theme.css'), 'utf8')
const knowledge = readFileSync(resolve(appDirectory, '..', 'features', 'knowledge', 'KnowledgePage.tsx'), 'utf8')
const gates = readFileSync(resolve(appDirectory, '..', 'features', 'gates', 'GatesDashboard.tsx'), 'utf8')

describe('unified module spacing contract', () => {
  it('defines shared page and section spacing tokens', () => {
    expect(theme).toContain('--space-page-inline:')
    expect(theme).toContain('--space-page-top:')
    expect(theme).toContain('--space-page-bottom:')
    expect(theme).toContain('--space-section:')
    expect(theme).toContain('--space-grid:')
  })

  it('maps regular pages, Knowledge and Gates to the same outer spacing', () => {
    expect(theme).toMatch(/\.page,\s*\.knowledge-page\s*\{[^}]*padding:/s)
    expect(knowledge).toContain('className="page knowledge-page"')
    expect(gates).toContain('className="page gates-dashboard"')
  })

  it('uses shared spacing for primary module grids and responsive layouts', () => {
    expect(theme).toContain('gap: var(--space-grid)')
    expect(theme).toContain('margin-bottom: var(--space-section)')
    expect(theme).toMatch(/@media \(max-width: 900px\)[\s\S]*--space-page-inline:/)
    expect(theme).toMatch(/@media \(max-width: 680px\)[\s\S]*--space-page-top:/)
  })
})
