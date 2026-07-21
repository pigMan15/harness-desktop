/**
 * Preload script — typed business API for Renderer.
 *
 * Architecture §8.1/§14: only exposes window.harness via contextBridge.
 * No exec, readFile, writeFile, require, or process exposure.
 */

import { contextBridge, ipcRenderer } from 'electron'

const VALID_EVENT_CHANNELS = ['runtime:status', 'runtime:error'] as const

contextBridge.exposeInMainWorld('harness', {
  // ── Runtime ──
  health: () => ipcRenderer.invoke('runtime:health'),

  // ── Projects ──
  listProjects: () => ipcRenderer.invoke('project:list'),
  importProject: (path: string) => ipcRenderer.invoke('project:import', path),
  validateProject: (path: string) => ipcRenderer.invoke('project:validate', path),

  // ── Runs ──
  listRuns: (projectId: string) => ipcRenderer.invoke('run:list', projectId),
  createRun: (projectId: string, intent: string, risk: string, runId: string) =>
    ipcRenderer.invoke('run:create', projectId, intent, risk, runId),

  // ── Workflow ──
  getWorkflow: (projectId: string) => ipcRenderer.invoke('workflow:get', projectId),
  compileWorkflow: (projectId: string, intent: string, risk: string) =>
    ipcRenderer.invoke('workflow:compile', projectId, intent, risk),

  // ── Gates ──
  listGates: (projectId: string) => ipcRenderer.invoke('gate:list', projectId),
  evaluateGate: (gateId: string, status: string) => ipcRenderer.invoke('gate:evaluate', gateId, status),

  // ── Artifacts ──
  listArtifacts: (projectId: string) => ipcRenderer.invoke('artifact:list', projectId),
  readArtifact: (projectId: string, filename: string) => ipcRenderer.invoke('artifact:read', projectId, filename),

  // ── Knowledge ──
  listKnowledge: (projectId: string, status: string) => ipcRenderer.invoke('knowledge:list', projectId, status),
  reviewKnowledge: (candidateId: number, decision: string) => ipcRenderer.invoke('knowledge:review', candidateId, decision),

  // ── Execution ──
  startExecution: (projectId: string, nodeId: string, role: string) => ipcRenderer.invoke('execution:start', projectId, nodeId, role),
  pollExecution: (sessionId: string) => ipcRenderer.invoke('execution:poll', sessionId),
  respondExecution: (sessionId: string, decision: any) => ipcRenderer.invoke('execution:respond', sessionId, decision),
  cancelExecution: (sessionId: string) => ipcRenderer.invoke('execution:cancel', sessionId),

  // ── Events ──
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => {
    if (VALID_EVENT_CHANNELS.includes(channel as typeof VALID_EVENT_CHANNELS[number])) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
})
