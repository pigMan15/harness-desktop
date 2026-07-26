import { describe, expect, it, vi } from 'vitest'
import { TerminalManager, type PtyProcess, windowsPtyOptions } from '../src/main/terminal-manager'

function fakePty(): PtyProcess & { emitData: (data: string) => void; emitExit: (code: number) => void } {
  let onData = (_data: string) => {}
  let onExit = (_event: { exitCode: number }) => {}
  return {
    pid: 42,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (callback) => { onData = callback; return { dispose: vi.fn() } },
    onExit: (callback) => { onExit = callback; return { dispose: vi.fn() } },
    emitData: (data) => onData(data),
    emitExit: (exitCode) => onExit({ exitCode }),
  }
}

describe('TerminalManager', () => {
  it('uses the bundled ConPTY DLL only on Windows', () => {
    const options = { cwd: 'G:/worktrees/run-a', env: {}, cols: 80, rows: 24 }

    expect(windowsPtyOptions(options, 'win32')).toEqual({ ...options, useConptyDll: true })
    expect(windowsPtyOptions(options, 'linux')).toEqual(options)
  })

  it('enforces one active session per project/run/node and event ownership', async () => {
    const pty = fakePty()
    const emit = vi.fn()
    const manager = new TerminalManager({
      getExecutionContext: vi.fn().mockResolvedValue({
        runId: 'run-a', currentNode: 'DEVELOPMENT', worktreePath: 'G:/worktrees/run-a',
        terminalAllowed: true, revision: 'r1', phaseDir: '.harness/phases/run-a',
      }),
      resolveExecutable: vi.fn().mockResolvedValue({ path: 'C:/tools/codex.exe', version: '0.145.0' }),
      spawnPty: vi.fn(() => pty),
      updateProjection: vi.fn().mockResolvedValue(undefined),
      emit,
      now: () => '2026-07-24T00:00:00Z',
      randomId: () => 'session-a',
    })

    const session = await manager.create(10, { projectId: 'project-a', runId: 'run-a', kind: 'codex', cols: 100, rows: 30 })
    await expect(manager.create(10, { projectId: 'project-a', runId: 'run-a', kind: 'codex', cols: 100, rows: 30 }))
      .rejects.toThrow('TERMINAL_SESSION_ALREADY_ACTIVE')
    expect(() => manager.write(11, session.sessionId, 'no')).toThrow('TERMINAL_SESSION_OWNER_MISMATCH')

    pty.emitData('hello')
    expect(emit).toHaveBeenCalledWith(10, 'terminal:data', expect.objectContaining({
      projectId: 'project-a', runId: 'run-a', nodeId: 'DEVELOPMENT', sequence: 1, data: 'hello',
    }))
    expect(manager.readScrollback(10, session.sessionId)).toEqual({ data: 'hello', sequence: 1 })
  })

  it('passes AI CLI provider through to executable resolution', async () => {
    const pty = fakePty()
    const resolveExecutable = vi.fn().mockResolvedValue({ path: 'C:/tools/claude.exe', version: '1.0.0' })
    const manager = new TerminalManager({
      getExecutionContext: vi.fn().mockResolvedValue({
        runId: 'run-a', currentNode: 'DEVELOPMENT', worktreePath: 'G:/worktrees/run-a',
        terminalAllowed: true, revision: 'r1', phaseDir: '.harness/phases/run-a',
      }),
      resolveExecutable,
      spawnPty: vi.fn(() => pty),
      updateProjection: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
      randomId: () => 'session-provider',
    })

    const session = await manager.create(10, { projectId: 'project-a', runId: 'run-a', kind: 'ai', provider: 'claude', cols: 100, rows: 30 })

    expect(resolveExecutable).toHaveBeenCalledWith('claude')
    expect(session.provider).toBe('claude')
  })

  it('marks active sessions interrupted during shutdown without completing nodes', async () => {
    const pty = fakePty()
    const updateProjection = vi.fn().mockResolvedValue(undefined)
    const manager = new TerminalManager({
      getExecutionContext: vi.fn().mockResolvedValue({
        runId: 'run-a', currentNode: 'DEVELOPMENT', worktreePath: 'G:/worktrees/run-a',
        terminalAllowed: true, revision: 'r1', phaseDir: '.harness/phases/run-a',
      }),
      resolveExecutable: vi.fn().mockResolvedValue({ path: 'C:/tools/codex.exe', version: '0.145.0' }),
      spawnPty: vi.fn(() => pty), updateProjection, emit: vi.fn(),
      now: () => '2026-07-24T00:00:00Z', randomId: () => 'session-a',
    })
    await manager.create(10, { projectId: 'project-a', runId: 'run-a', kind: 'codex', cols: 100, rows: 30 })

    await manager.shutdown()

    expect(pty.kill).toHaveBeenCalled()
    expect(updateProjection).toHaveBeenLastCalledWith('project-a', expect.objectContaining({ status: 'interrupted' }))
  })

  it('keeps concurrent runs isolated and stopping one leaves the other writable', async () => {
    const ptys = [fakePty(), fakePty()]
    let index = 0
    const manager = new TerminalManager({
      getExecutionContext: vi.fn(async (_projectId, runId) => ({ runId, currentNode: 'DEVELOPMENT', worktreePath: `G:/worktrees/${runId}`, terminalAllowed: true, phaseDir: `.harness/phases/${runId}` })),
      resolveExecutable: vi.fn().mockResolvedValue({ path: 'C:/tools/codex.exe', version: '0.145.0' }),
      spawnPty: vi.fn(() => ptys[index++]), updateProjection: vi.fn().mockResolvedValue(undefined), emit: vi.fn(),
      randomId: () => `session-${index}`,
    })
    const first = await manager.create(10, { projectId: 'project-a', runId: 'run-a', kind: 'codex', cols: 80, rows: 24 })
    const second = await manager.create(10, { projectId: 'project-a', runId: 'run-b', kind: 'codex', cols: 100, rows: 30 })

    await manager.stop(10, first.sessionId)
    manager.write(10, second.sessionId, 'still-running')

    expect(ptys[0].kill).toHaveBeenCalledOnce()
    expect(ptys[1].kill).not.toHaveBeenCalled()
    expect(ptys[1].write).toHaveBeenCalledWith('still-running')
  })

  it('enforces project and global limits independently', async () => {
    const createManager = (projectLimit: number, globalLimit: number) => new TerminalManager({
      getExecutionContext: vi.fn(async (_projectId, runId) => ({ runId, currentNode: 'DEVELOPMENT', worktreePath: `G:/worktrees/${runId}`, terminalAllowed: true, phaseDir: `.harness/phases/${runId}` })),
      resolveExecutable: vi.fn().mockResolvedValue({ path: 'C:/tools/codex.exe', version: '0.145.0' }),
      spawnPty: vi.fn(() => fakePty()), updateProjection: vi.fn().mockResolvedValue(undefined), emit: vi.fn(), projectLimit, globalLimit,
    })
    const projectLimited = createManager(1, 8)
    await projectLimited.create(1, { projectId: 'a', runId: 'one', kind: 'codex', cols: 80, rows: 24 })
    await expect(projectLimited.create(1, { projectId: 'a', runId: 'two', kind: 'codex', cols: 80, rows: 24 })).rejects.toThrow('TERMINAL_PROJECT_LIMIT')

    const globallyLimited = createManager(4, 1)
    await globallyLimited.create(1, { projectId: 'a', runId: 'one', kind: 'codex', cols: 80, rows: 24 })
    await expect(globallyLimited.create(1, { projectId: 'b', runId: 'two', kind: 'codex', cols: 80, rows: 24 })).rejects.toThrow('TERMINAL_GLOBAL_LIMIT')
  })

  it('clamps resize, bounds input, restarts, and redacts persisted scrollback', async () => {
    const ptys = [fakePty(), fakePty()]
    const updateProjection = vi.fn().mockResolvedValue(undefined)
    let spawnIndex = 0
    let idIndex = 0
    const manager = new TerminalManager({
      getExecutionContext: vi.fn().mockResolvedValue({ runId: 'run-a', currentNode: 'DEVELOPMENT', worktreePath: 'G:/worktrees/run-a', terminalAllowed: true, phaseDir: '.harness/phases/run-a' }),
      resolveExecutable: vi.fn().mockResolvedValue({ path: 'C:/tools/codex.exe', version: '0.145.0' }),
      spawnPty: vi.fn(() => ptys[spawnIndex++]), updateProjection, emit: vi.fn(),
      randomId: () => `session-${++idIndex}`, scrollbackLimit: 80,
    })
    const first = await manager.create(1, { projectId: 'project-a', runId: 'run-a', kind: 'codex', cols: 80, rows: 24 })
    manager.resize(1, first.sessionId, 999, 1)
    expect(ptys[0].resize).toHaveBeenCalledWith(500, 5)
    expect(() => manager.write(1, first.sessionId, 'x'.repeat(64 * 1024 + 1))).toThrow('TERMINAL_INPUT_TOO_LARGE')
    ptys[0].emitData('token=private-value sk-abcdefghijklmnop')

    const restarted = await manager.restart(1, first.sessionId)
    expect(restarted.sessionId).toBe('session-2')
    expect(updateProjection).toHaveBeenCalledWith('project-a', expect.objectContaining({ summary: expect.stringContaining('[REDACTED]') }))
  })
})
