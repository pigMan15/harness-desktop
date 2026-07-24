import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'TerminalPage.tsx'), 'utf8')

describe('TerminalPage source contract', () => {
  it('uses xterm fit/search and the typed PTY bridge', () => {
    expect(source).toContain("from '@xterm/xterm'")
    expect(source).toContain("from '@xterm/addon-fit'")
    expect(source).toContain("from '@xterm/addon-search'")
    expect(source).toContain('window.harness.createTerminal')
    expect(source).toContain('window.harness.onTerminalData')
    expect(source).toContain('window.harness.resizeTerminal')
  })

  it('shows authoritative run context and explicit node completion', () => {
    expect(source).toContain('getRunExecutionContext')
    expect(source).toContain('completeNode')
    expect(source).toContain('confirmNode')
    expect(source).toContain('worktreePath')
  })
})
