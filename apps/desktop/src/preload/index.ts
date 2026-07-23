import { contextBridge, ipcRenderer } from 'electron'
import type { HarnessApi } from './harness-api'
const VALID_EVENT_CHANNELS = ['runtime:status','runtime:error'] as const

const harnessApi: HarnessApi = {
  health: () => ipcRenderer.invoke('runtime:health'),
  listProjects: () => ipcRenderer.invoke('project:list'),
  importProject: (p: string) => ipcRenderer.invoke('project:import', p),
  validateProject: (p: string) => ipcRenderer.invoke('project:validate', p),
  listRuns: (p: string) => ipcRenderer.invoke('run:list', p),
  createRun: (p: string,i: string,r: string,id: string,rev?: string) => ipcRenderer.invoke('run:create',p,i,r,id,rev),
  switchRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:switch',p,id,rev),
  pauseRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:pause',p,id,rev),
  resumeRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:resume',p,id,rev),
  getWorkflow: (p: string) => ipcRenderer.invoke('workflow:get', p),
  compileWorkflow: (p: string,i: string,r: string) => ipcRenderer.invoke('workflow:compile',p,i,r),
  previewWorkflow: (p,n,i,r,route) => ipcRenderer.invoke('workflow:preview',p,n,i,r,route),
  diffWorkflow: (p: string,y: string) => ipcRenderer.invoke('workflow:diff',p,y),
  applyWorkflow: (p: string,y: string,h: string) => ipcRenderer.invoke('workflow:apply',p,y,h),
  listGates: (p: string,r: string) => ipcRenderer.invoke('gate:list', p,r),
  evaluateGate: (p: string,r: string,g: string,rev?: string) => ipcRenderer.invoke('gate:evaluate',p,r,g,rev),
  listArtifacts: (p: string,r: string) => ipcRenderer.invoke('artifact:list', p,r),
  readArtifact: (p: string,r: string,f: string) => ipcRenderer.invoke('artifact:read',p,r,f),
  listKnowledge: (p: string,s: string) => ipcRenderer.invoke('knowledge:list',p,s),
  reviewKnowledge: (p: string,id: number,d: string) => ipcRenderer.invoke('knowledge:review',p,id,d),
  probeExecution: (p: string) => ipcRenderer.invoke('execution:probe',p),
  startExecution: (p: string,r: string,rev?: string) => ipcRenderer.invoke('execution:start',p,r,rev),
  pollExecution: (p: string,r: string,s: string) => ipcRenderer.invoke('execution:poll',p,r,s),
  respondExecution: (p: string,r: string,s: string,d) => ipcRenderer.invoke('execution:respond',p,r,s,d),
  cancelExecution: (p: string,r: string,s: string) => ipcRenderer.invoke('execution:cancel',p,r,s),
  scanRecovery: (p: string) => ipcRenderer.invoke('recovery:scan',p),
  cleanupRecovery: (p: string) => ipcRenderer.invoke('recovery:cleanup',p),
  onRuntimeEvent: (ch: string,cb: (...a: any[]) => void) => { if (VALID_EVENT_CHANNELS.includes(ch as typeof VALID_EVENT_CHANNELS[number])) ipcRenderer.on(ch,(_e,...a) => cb(...a)) },
}

contextBridge.exposeInMainWorld('harness', harnessApi)
