/**
 * Preload script — exposes typed business API to the Renderer.
 *
 * Architecture §8.1/§14:
 * - Only exposes window.harness via contextBridge
 * - Does NOT expose exec, readFile, writeFile, require, process
 * - Renderer has no Node.js or shell access
 *
 * Security: this is the ONLY channel between Renderer and Main.
 * Adding a new method requires updating the allowlist below.
 */

import { contextBridge, ipcRenderer } from 'electron'

/** Valid event channels — explicit allowlist (architecture §14). */
const VALID_EVENT_CHANNELS = ['runtime:status', 'runtime:error'] as const

contextBridge.exposeInMainWorld('harness', {
  /** Query the Runtime health status via IPC → Main → Runtime HTTP. */
  health: (): Promise<{ healthy: boolean; runtimeVersion?: string; protocolVersion?: string }> =>
    ipcRenderer.invoke('runtime:health'),

  /** Subscribe to Runtime lifecycle events (status or error). */
  onRuntimeEvent: (
    channel: string,
    callback: (...args: unknown[]) => void,
  ): void => {
    if (VALID_EVENT_CHANNELS.includes(channel as (typeof VALID_EVENT_CHANNELS)[number])) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
})

// Security verification: this file must NOT contain:
// - require() calls (except for the TypeScript import above)
// - fs, child_process, net, or other Node built-in imports
// - process.env access
