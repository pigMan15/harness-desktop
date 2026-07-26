import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = dirname(fileURLToPath(import.meta.url))
const theme = readFileSync(resolve(appDirectory, 'theme.css'), 'utf8')
const entry = readFileSync(resolve(appDirectory, 'main.tsx'), 'utf8')

describe('unified renderer theme contract', () => {
  it('defines reusable semantic design tokens and loads the theme last', () => {
    expect(theme).toContain('--color-brand:')
    expect(theme).toContain('--surface-canvas:')
    expect(theme).toContain('--radius-card:')
    expect(theme).toContain('--shadow-card:')
    expect(theme).toContain('--motion-fast:')
    expect(entry.indexOf("import './theme.css'")).toBeGreaterThan(entry.indexOf("import './styles.css'"))
  })

  it('unifies the application shell, controls and feature workbenches', () => {
    expect(theme).toContain('.sidebar {')
    expect(theme).toContain('.nav-link.active')
    expect(theme).toContain('.workspace-header {')
    expect(theme).toContain('.button {')
    expect(theme).toContain(':focus-visible')
    expect(theme).toContain('.artifacts-workbench')
    expect(theme).toContain('.knowledge-card')
    expect(theme).toContain('.gate-card')
    expect(theme).toContain('.run-merge-drawer')
  })

  it('provides responsive and reduced-motion behavior', () => {
    expect(theme).toContain('@media (max-width: 900px)')
    expect(theme).toContain('@media (max-width: 680px)')
    expect(theme).toContain('@media (prefers-reduced-motion: reduce)')
    expect(theme).toContain('animation-duration: 0.01ms')
  })

  it('keeps terminal sizing surfaces free from transform animations', () => {
    const terminalHostRule = theme.match(/\.terminal-host\s*\{([^}]*)\}/)?.[1] ?? ''
    const xtermRule = theme.match(/\.terminal-host \.xterm\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(terminalHostRule).not.toContain('transform')
    expect(xtermRule).not.toContain('transform')
    expect(theme).toContain('.terminal-page { animation: none; }')
  })
})
