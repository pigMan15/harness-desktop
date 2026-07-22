import { contextBridge, ipcRenderer } from 'electron'
const VALID_EVENT_CHANNELS = ['runtime:status','runtime:error'] as const

contextBridge.exposeInMainWorld('harness', {
  health: () => ipcRenderer.invoke('runtime:health'),
  listProjects: () => ipcRenderer.invoke('project:list'),
  importProject: (p: string) => ipcRenderer.invoke('project:import', p),
  validateProject: (p: string) => ipcRenderer.invoke('project:validate', p),
  listRuns: (p: string) => ipcRenderer.invoke('run:list', p),
  createRun: (p: string,i: string,r: string,id: string) => ipcRenderer.invoke('run:create',p,i,r,id),
  getWorkflow: (p: string) => ipcRenderer.invoke('workflow:get', p),
  compileWorkflow: (p: string,i: string,r: string) => ipcRenderer.invoke('workflow:compile',p,i,r),
  diffWorkflow: (p: string,y: string) => ipcRenderer.invoke('workflow:diff',p,y),
  applyWorkflow: (p: string,y: string,h: string) => ipcRenderer.invoke('workflow:apply',p,y,h),
  listGates: (p: string) => ipcRenderer.invoke('gate:list', p),
  evaluateGate: (g: string,s: string) => ipcRenderer.invoke('gate:evaluate',g,s),
  listArtifacts: (p: string) => ipcRenderer.invoke('artifact:list', p),
  readArtifact: (p: string,f: string) => ipcRenderer.invoke('artifact:read',p,f),
  listKnowledge: (p: string,s: string) => ipcRenderer.invoke('knowledge:list',p,s),
  reviewKnowledge: (id: number,d: string) => ipcRenderer.invoke('knowledge:review',id,d),
  startExecution: (p: string,n: string,r: string) => ipcRenderer.invoke('execution:start',p,n,r),
  pollExecution: (s: string) => ipcRenderer.invoke('execution:poll',s),
  respondExecution: (s: string,d: any) => ipcRenderer.invoke('execution:respond',s,d),
  cancelExecution: (s: string) => ipcRenderer.invoke('execution:cancel',s),
  scanRecovery: (p: string) => ipcRenderer.invoke('recovery:scan',p),
  cleanupRecovery: (p: string) => ipcRenderer.invoke('recovery:cleanup',p),
  onRuntimeEvent: (ch: string,cb: (...a: any[]) => void) => { if (VALID_EVENT_CHANNELS.includes(ch as typeof VALID_EVENT_CHANNELS[number])) ipcRenderer.on(ch,(_e,...a) => cb(...a)) },
})
