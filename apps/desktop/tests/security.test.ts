/**
 * Security tests — verify the Electron shell's safety guarantees.
 *
 * Architecture §14: Renderer must have no Node/Shell access.
 * Implementation plan Task 1.4: 6 security assertions.
 *
 * These tests verify the PRELOAD module structure.
 * Full runtime verification (actual Electron window) requires Playwright E2E (Phase 7).
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const PRELOAD_PATH = path.resolve(__dirname, '..', 'src', 'preload', 'index.ts')

describe('Preload security', () => {
  it('preload file exists', () => {
    expect(fs.existsSync(PRELOAD_PATH)).toBe(true)
  })

  it('preload does not export require', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    // Must not re-export or expose require
    expect(source).not.toMatch(/exposeInMainWorld.*require/)
    expect(source).not.toMatch(/window\[.require.\]/)
  })

  it('preload does not expose exec', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    expect(source).not.toMatch(/exposeInMainWorld.*exec/)
    expect(source).not.toMatch(/child_process/)
  })

  it('preload does not expose readFile or writeFile', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    expect(source).not.toMatch(/exposeInMainWorld.*readFile/)
    expect(source).not.toMatch(/exposeInMainWorld.*writeFile/)
    expect(source).not.toMatch(/import.*['"]fs['"]/)
    expect(source).not.toMatch(/require\(['"]fs['"]\)/)
  })

  it('preload uses contextBridge correctly', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    // Must use contextBridge (the only safe way to expose API)
    expect(source).toMatch(/contextBridge/)
    expect(source).toMatch(/exposeInMainWorld/)
  })

  it('preload event channels are allow-listed', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    // Event channel array must be const (immutable, static allowlist)
    expect(source).toMatch(/VALID_EVENT_CHANNELS/)
  })

  it('preload exposes project-bound run, workflow, gate, and Codex methods', () => {
    const source = fs.readFileSync(PRELOAD_PATH, 'utf-8')
    for (const method of ['switchRun', 'pauseRun', 'resumeRun', 'previewWorkflow', 'evaluateGate', 'probeExecution']) {
      expect(source).toContain(`${method}:`)
    }
    expect(source).toContain("ipcRenderer.invoke('execution:poll',p,r,s)")
    expect(source).toContain("ipcRenderer.invoke('gate:evaluate',p,r,g,rev)")
    expect(source).not.toContain("ipcRenderer.invoke('gate:evaluate',g,s)")
  })
})
