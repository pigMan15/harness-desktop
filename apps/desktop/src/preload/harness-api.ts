export type TerminalStatus = 'starting' | 'running' | 'exited' | 'failed' | 'stopped' | 'interrupted'
export interface TerminalCreateRequest { projectId: string; runId: string; kind: 'codex' | 'shell'; cols: number; rows: number }
export interface TerminalSessionSummary {
  sessionId: string; projectId: string; runId: string; nodeId: string; kind: 'codex' | 'shell'
  executablePath: string; cwd: string; pid?: number; status: TerminalStatus; startedAt: string
  endedAt?: string; exitCode?: number; cols: number; rows: number; sequence: number; summary: string
}
export interface TerminalEvent extends Partial<TerminalSessionSummary> { sessionId: string; projectId: string; runId: string; nodeId: string; sequence: number; data?: string }
export interface CodexSettings { executablePath: string; version: string; lastProbeStatus: 'available' | 'unavailable'; lastProbeAt: string; source: 'user' | 'environment' | 'hermes' | 'path' }

export interface HarnessApi {
  health: () => Promise<Record<string, unknown>>
  listProjects: () => Promise<unknown>
  importProject: (path: string) => Promise<unknown>
  validateProject: (path: string) => Promise<unknown>
  repairProject: (projectId: string) => Promise<unknown>
  unregisterProject: (projectId: string) => Promise<unknown>
  relocateProject: (projectId: string) => Promise<unknown>
  listRuns: (projectId: string) => Promise<unknown>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<unknown>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  archiveRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  mergeRunBack: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  getRunExecutionContext: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  completeNode: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  confirmNode: (projectId: string, runId: string, decision: 'accept' | 'reject' | 'defer', comment: string, expectedRevision?: string) => Promise<unknown>
  rejectNode: (projectId: string, runId: string, comment: string, expectedRevision?: string) => Promise<unknown>
  getWorkflow: (projectId: string, runId?: string) => Promise<unknown>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<unknown>
  previewWorkflow: (projectId: string, nodes: unknown[], intent: string, risk: string, route: string[], options?: Record<string, unknown>) => Promise<unknown>
  diffWorkflow: (projectId: string, yaml: string) => Promise<unknown>
  previewWorkflowYaml: (projectId: string, yaml: string) => Promise<unknown>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<unknown>
  importWorkflow: (projectId: string) => Promise<unknown>
  exportWorkflow: (projectId: string, format: 'yaml' | 'zip') => Promise<unknown>
  listWorkflowVersions: (projectId: string) => Promise<unknown>
  restoreWorkflowVersion: (projectId: string, versionId: number, expectedHash: string) => Promise<unknown>
  listGates: (projectId: string, runId: string) => Promise<unknown>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<unknown>
  waiveGate: (projectId: string, runId: string, gateId: string, scope: string, reason: string, owner: string, expectedRevision?: string) => Promise<unknown>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  hashArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  getCodexSettings: () => Promise<CodexSettings | { error: string } | undefined>
  discoverCodex: () => Promise<unknown>
  selectCodexExecutable: () => Promise<unknown>
  createTerminal: (request: TerminalCreateRequest) => Promise<TerminalSessionSummary>
  listTerminals: (projectId: string) => Promise<TerminalSessionSummary[]>
  writeTerminal: (sessionId: string, data: string) => Promise<void>
  getTerminalScrollback: (sessionId: string) => Promise<{ data: string; sequence: number; missing?: boolean }>
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
  stopTerminal: (sessionId: string) => Promise<TerminalSessionSummary>
  restartTerminal: (sessionId: string) => Promise<TerminalSessionSummary>
  onTerminalData: (callback: (event: TerminalEvent) => void) => () => void
  onTerminalExit: (callback: (event: TerminalEvent) => void) => () => void
  onTerminalStatus: (callback: (event: TerminalEvent) => void) => () => void
  exportDiagnostics: (projectId: string) => Promise<unknown>
  listKnowledge: (projectId: string, status: string) => Promise<unknown>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<unknown>
  getKnowledgeRepoStatus: (projectId: string) => Promise<unknown>
  configureKnowledgeRepo: (projectId: string, localPath: string, remoteUrl: string, branch: string) => Promise<unknown>
  inspectKnowledgeRepoLocalPath: (projectId: string, localPath: string) => Promise<unknown>
  pullKnowledgeRepo: (projectId: string) => Promise<unknown>
  synthesizeKnowledgeRepo: (projectId: string, candidateIds: number[]) => Promise<unknown>
  startKnowledgeCodexSynthesis: (projectId: string, candidateIds: number[], allowDirty?: boolean) => Promise<unknown>
  getActiveKnowledgeCodexSynthesis: (projectId: string) => Promise<unknown>
  pollKnowledgeCodexSynthesis: (projectId: string, sessionId: string) => Promise<unknown>
  respondKnowledgeCodexSynthesis: (projectId: string, sessionId: string, decision: unknown) => Promise<unknown>
  cancelKnowledgeCodexSynthesis: (projectId: string, sessionId: string) => Promise<unknown>
  pushKnowledgeRepo: (projectId: string) => Promise<unknown>
  probeExecution: (projectId: string) => Promise<unknown>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: unknown) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown>
  cleanupRecovery: (projectId: string) => Promise<unknown>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void
}
