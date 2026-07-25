export interface ProjectSummary {
  projectId: string
  name: string
  path: string
  protocolVersion: string
  health: 'healthy' | 'degraded' | 'readonly'
  activeRunId?: string
}

export interface RunSummary {
  run_id: string
  intent: string
  risk: string
  status: string
  current_node: string
  next_role: string
  completed_nodes: string[]
  required_nodes: string[]
  blocked_by: string[]
  phase_dir: string
  active: boolean
  revision: string
  branch_name?: string
  worktree_path?: string
  worktree_status?: string
  merged_back?: boolean
  merged_target_branch?: string
  merged_commit?: string
  merged_at?: string
  archived?: boolean
  archived_at?: string
}

export type TerminalStatus = 'starting' | 'running' | 'exited' | 'failed' | 'stopped' | 'interrupted'
export interface TerminalCreateRequest { projectId: string; runId: string; kind: 'codex' | 'shell'; cols: number; rows: number }
export interface TerminalSessionSummary {
  sessionId: string; projectId: string; runId: string; nodeId: string; kind: 'codex' | 'shell'
  executablePath: string; cwd: string; pid?: number; status: TerminalStatus; startedAt: string
  endedAt?: string; exitCode?: number; cols: number; rows: number; sequence: number; summary: string
}
export interface TerminalEvent extends Partial<TerminalSessionSummary> { sessionId: string; projectId: string; runId: string; nodeId: string; sequence: number; data?: string }
export interface CodexSettings { executablePath: string; version: string; lastProbeStatus: 'available' | 'unavailable'; lastProbeAt: string; source: 'user' | 'environment' | 'hermes' | 'path' }

export interface WorkflowNode { id: string; role: string; artifact: string; gates: string[] }
export interface ExecutionDecision { requestId: number; decision: 'allow_once' | 'allow_session' | 'deny' | 'cancel' }
type ApiObject = Record<string, unknown> & { error?: string }

export interface HarnessApi {
  health: () => Promise<ApiObject>
  listProjects: () => Promise<ProjectSummary[] | { error: string }>
  importProject: (path: string) => Promise<ProjectSummary | { error: string }>
  validateProject: (path: string) => Promise<ApiObject>
  repairProject: (projectId: string) => Promise<ApiObject>
  unregisterProject: (projectId: string) => Promise<ApiObject>
  relocateProject: (projectId: string) => Promise<ApiObject>
  listRuns: (projectId: string) => Promise<RunSummary[] | { error: string }>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  archiveRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  mergeRunBack: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  getRunExecutionContext: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  completeNode: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  confirmNode: (projectId: string, runId: string, decision: 'accept' | 'reject' | 'defer', comment: string, expectedRevision?: string) => Promise<ApiObject>
  rejectNode: (projectId: string, runId: string, comment: string, expectedRevision?: string) => Promise<ApiObject>
  getWorkflow: (projectId: string, runId?: string) => Promise<ApiObject>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<ApiObject>
  previewWorkflow: (projectId: string, nodes: WorkflowNode[], intent: string, risk: string, route: string[], options?: Record<string, unknown>) => Promise<ApiObject>
  diffWorkflow: (projectId: string, yaml: string) => Promise<ApiObject>
  previewWorkflowYaml: (projectId: string, yaml: string) => Promise<ApiObject>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<ApiObject>
  importWorkflow: (projectId: string) => Promise<ApiObject>
  exportWorkflow: (projectId: string, format: 'yaml' | 'zip') => Promise<ApiObject>
  listWorkflowVersions: (projectId: string) => Promise<unknown>
  restoreWorkflowVersion: (projectId: string, versionId: number, expectedHash: string) => Promise<ApiObject>
  listGates: (projectId: string, runId: string) => Promise<ApiObject>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<ApiObject>
  waiveGate: (projectId: string, runId: string, gateId: string, scope: string, reason: string, owner: string, expectedRevision?: string) => Promise<ApiObject>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown[] | { error: string }>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<ApiObject>
  hashArtifact: (projectId: string, runId: string, filename: string) => Promise<ApiObject>
  getCodexSettings: () => Promise<CodexSettings | { error: string } | undefined>
  discoverCodex: () => Promise<ApiObject>
  selectCodexExecutable: () => Promise<ApiObject>
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
  exportDiagnostics: (projectId: string) => Promise<ApiObject>
  listKnowledge: (projectId: string, status: string) => Promise<unknown[] | { error: string }>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<ApiObject>
  getKnowledgeRepoStatus: (projectId: string) => Promise<ApiObject>
  configureKnowledgeRepo: (projectId: string, localPath: string, remoteUrl: string, branch: string) => Promise<ApiObject>
  pullKnowledgeRepo: (projectId: string) => Promise<ApiObject>
  synthesizeKnowledgeRepo: (projectId: string, candidateIds: number[]) => Promise<ApiObject>
  pushKnowledgeRepo: (projectId: string) => Promise<ApiObject>
  probeExecution: (projectId: string) => Promise<ApiObject>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: ExecutionDecision) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown[] | { error: string }>
  cleanupRecovery: (projectId: string) => Promise<string[] | { error: string }>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global { interface Window { harness?: HarnessApi } }
