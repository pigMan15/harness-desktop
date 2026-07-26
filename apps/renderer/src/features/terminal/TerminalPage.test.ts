import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'TerminalPage.tsx'), 'utf8')
const styles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'styles.css'), 'utf8')

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

  it('bounds the terminal grid and de-duplicates PTY resize updates', () => {
    expect(styles).toContain('grid-template-rows: auto auto auto minmax(0, 1fr) auto')
    expect(styles).toContain('.terminal-host { min-height: 0; height: 100%')
    expect(source).toContain('lastTerminalSize.cols === terminal.cols')
    expect(source).toContain('lastTerminalSize.rows === terminal.rows')
  })

  it('routes paste shortcuts through clipboard text instead of PTY control characters', () => {
    expect(source).toContain('attachCustomKeyEventHandler')
    expect(source).toContain("key === 'v' && (event.ctrlKey || event.metaKey)")
    expect(source).toContain("event.key === 'Insert' && event.shiftKey")
    expect(source).toContain("getData('text/plain')")
    expect(source).toContain('pasteClipboardText')
  })

  it('preserves Chinese IME composition and input typed during scrollback replay', () => {
    expect(source).toContain('event.isComposing')
    expect(source).toContain("event.key === 'Process'")
    expect(source).toContain('event.keyCode === 229')
    expect(source).toContain('pendingInput += data')
    expect(source).toContain('writeTerminalText(inputAfterReplay)')
    expect(source).toContain('terminal.focus()')
    expect(source).toContain('Microsoft YaHei UI')
  })
})
