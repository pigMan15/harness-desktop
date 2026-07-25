import { contextBridge, ipcRenderer } from 'electron'
import type { HarnessApi } from './harness-api'
const VALID_EVENT_CHANNELS = ['runtime:status','runtime:error'] as const

const harnessApi: HarnessApi = {
  health: () => ipcRenderer.invoke('runtime:health'),
  listProjects: () => ipcRenderer.invoke('project:list'),
  importProject: (p: string) => ipcRenderer.invoke('project:import', p),
  validateProject: (p: string) => ipcRenderer.invoke('project:validate', p),
  repairProject: (p: string) => ipcRenderer.invoke('project:repair',p),
  unregisterProject: (p: string) => ipcRenderer.invoke('project:unregister',p),
  relocateProject: (p: string) => ipcRenderer.invoke('project:relocate',p),
  listRuns: (p: string) => ipcRenderer.invoke('run:list', p),
  createRun: (p: string,i: string,r: string,id: string,rev?: string) => ipcRenderer.invoke('run:create',p,i,r,id,rev),
  switchRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:switch',p,id,rev),
  pauseRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:pause',p,id,rev),
  resumeRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:resume',p,id,rev),
  archiveRun: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:archive',p,id,rev),
  mergeRunBack: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:merge-back',p,id,rev),
  getRunExecutionContext: (p: string,id: string,rev?: string) => ipcRenderer.invoke('run:execution-context',p,id,rev),
  completeNode: (p: string,id: string,rev?: string) => ipcRenderer.invoke('node:complete',p,id,rev),
  confirmNode: (p: string,id: string,d,c,rev?: string) => ipcRenderer.invoke('node:confirm',p,id,d,c,rev),
  rejectNode: (p: string,id: string,c,rev?: string) => ipcRenderer.invoke('node:reject',p,id,c,rev),
  getWorkflow: (p: string,r?: string) => ipcRenderer.invoke('workflow:get', p,r),
  compileWorkflow: (p: string,i: string,r: string) => ipcRenderer.invoke('workflow:compile',p,i,r),
  previewWorkflow: (p,n,i,r,route,o) => ipcRenderer.invoke('workflow:preview',p,n,i,r,route,o),
  diffWorkflow: (p: string,y: string) => ipcRenderer.invoke('workflow:diff',p,y),
  previewWorkflowYaml: (p: string,y: string) => ipcRenderer.invoke('workflow:preview-yaml',p,y),
  applyWorkflow: (p: string,y: string,h: string) => ipcRenderer.invoke('workflow:apply',p,y,h),
  importWorkflow: (p: string) => ipcRenderer.invoke('workflow:import',p),
  exportWorkflow: (p: string,f: 'yaml' | 'zip') => ipcRenderer.invoke('workflow:export',p,f),
  listWorkflowVersions: (p: string) => ipcRenderer.invoke('workflow:versions',p),
  restoreWorkflowVersion: (p: string,id: number,h: string) => ipcRenderer.invoke('workflow:restore',p,id,h),
  listGates: (p: string,r: string) => ipcRenderer.invoke('gate:list', p,r),
  evaluateGate: (p: string,r: string,g: string,rev?: string) => ipcRenderer.invoke('gate:evaluate',p,r,g,rev),
  waiveGate: (p: string,r: string,g: string,s: string,reason: string,o: string,rev?: string) => ipcRenderer.invoke('gate:waive',p,r,g,s,reason,o,rev),
  listArtifacts: (p: string,r: string) => ipcRenderer.invoke('artifact:list', p,r),
  readArtifact: (p: string,r: string,f: string) => ipcRenderer.invoke('artifact:read',p,r,f),
  hashArtifact: (p: string,r: string,f: string) => ipcRenderer.invoke('artifact:hash',p,r,f),
  getCodexSettings: () => ipcRenderer.invoke('codex-settings:get'),
  discoverCodex: () => ipcRenderer.invoke('codex-settings:discover'),
  selectCodexExecutable: () => ipcRenderer.invoke('codex-settings:select'),
  createTerminal: (request) => ipcRenderer.invoke('terminal:create',request),
  listTerminals: (p: string) => ipcRenderer.invoke('terminal:list',p),
  writeTerminal: (id: string,data: string) => ipcRenderer.invoke('terminal:write',id,data),
  getTerminalScrollback: (id: string) => ipcRenderer.invoke('terminal:scrollback',id),
  resizeTerminal: (id: string,cols: number,rows: number) => ipcRenderer.invoke('terminal:resize',id,cols,rows),
  stopTerminal: (id: string) => ipcRenderer.invoke('terminal:stop',id),
  restartTerminal: (id: string) => ipcRenderer.invoke('terminal:restart',id),
  onTerminalData: (cb) => subscribe('terminal:data',cb),
  onTerminalExit: (cb) => subscribe('terminal:exit',cb),
  onTerminalStatus: (cb) => subscribe('terminal:status',cb),
  exportDiagnostics: (p: string) => ipcRenderer.invoke('diagnostics:export',p),
  listKnowledge: (p: string,s: string) => ipcRenderer.invoke('knowledge:list',p,s),
  reviewKnowledge: (p: string,id: number,d: string) => ipcRenderer.invoke('knowledge:review',p,id,d),
  getKnowledgeRepoStatus: (p: string) => ipcRenderer.invoke('knowledge:repo-status',p),
  configureKnowledgeRepo: (p: string,l: string,r: string,b: string) => ipcRenderer.invoke('knowledge:repo-configure',p,l,r,b),
  inspectKnowledgeRepoLocalPath: (p: string,l: string) => ipcRenderer.invoke('knowledge:repo-inspect-local',p,l),
  pullKnowledgeRepo: (p: string) => ipcRenderer.invoke('knowledge:repo-pull',p),
  synthesizeKnowledgeRepo: (p: string,ids: number[]) => ipcRenderer.invoke('knowledge:repo-synthesize',p,ids),
  startKnowledgeCodexSynthesis: (p: string,ids: number[],allowDirty?: boolean) => ipcRenderer.invoke('knowledge:repo-codex-start',p,ids,allowDirty),
  getActiveKnowledgeCodexSynthesis: (p: string) => ipcRenderer.invoke('knowledge:repo-codex-active',p),
  pollKnowledgeCodexSynthesis: (p: string,s: string) => ipcRenderer.invoke('knowledge:repo-codex-poll',p,s),
  respondKnowledgeCodexSynthesis: (p: string,s: string,d) => ipcRenderer.invoke('knowledge:repo-codex-respond',p,s,d),
  sendKnowledgeCodexFeedback: (p: string,s: string,f: string) => ipcRenderer.invoke('knowledge:repo-codex-feedback',p,s,f),
  cancelKnowledgeCodexSynthesis: (p: string,s: string) => ipcRenderer.invoke('knowledge:repo-codex-cancel',p,s),
  pushKnowledgeRepo: (p: string) => ipcRenderer.invoke('knowledge:repo-push',p),
  probeExecution: (p: string) => ipcRenderer.invoke('execution:probe',p),
  startExecution: (p: string,r: string,rev?: string) => ipcRenderer.invoke('execution:start',p,r,rev),
  pollExecution: (p: string,r: string,s: string) => ipcRenderer.invoke('execution:poll',p,r,s),
  respondExecution: (p: string,r: string,s: string,d) => ipcRenderer.invoke('execution:respond',p,r,s,d),
  cancelExecution: (p: string,r: string,s: string) => ipcRenderer.invoke('execution:cancel',p,r,s),
  scanRecovery: (p: string) => ipcRenderer.invoke('recovery:scan',p),
  cleanupRecovery: (p: string) => ipcRenderer.invoke('recovery:cleanup',p),
  onRuntimeEvent: (ch: string,cb: (...a: any[]) => void) => {
    if (!VALID_EVENT_CHANNELS.includes(ch as typeof VALID_EVENT_CHANNELS[number])) return () => {}
    const listener = (_e: unknown,...a: unknown[]) => cb(...a)
    ipcRenderer.on(ch,listener)
    return () => ipcRenderer.removeListener(ch,listener)
  },
}

function subscribe(channel: 'terminal:data' | 'terminal:exit' | 'terminal:status', callback: (event: any) => void): () => void {
  const listener = (_event: unknown, payload: unknown) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('harness', harnessApi)
