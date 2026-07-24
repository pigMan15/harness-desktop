/** Shared RPC contract types — must stay in sync with schemas/rpc.schema.json. */

/** Metadata attached to every command (architecture §11). */
export interface CommandMeta {
  requestId: string
  projectId: string
  runId?: string
  expectedRevision?: string
}

/** JSON-RPC 2.0 request. */
export interface RpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string
  meta: CommandMeta
}

/** JSON-RPC 2.0 response. */
export interface RpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: RpcError
  id: string
}

/** Structured RPC error with optional JSON Pointer (RFC 6901). */
export interface RpcError {
  code: string
  message: string
  pointer?: string
}

/** Runtime event types (architecture §11 WebSocket events). */
export type RuntimeEventType =
  | 'StateChanged'
  | 'WorkflowChanged'
  | 'ExecutionOutput'
  | 'ToolCall'
  | 'ApprovalRequested'
  | 'GateEvaluated'
  | 'ArtifactChanged'
  | 'ExecutorExited'
  | 'RuntimeWarning'

/** Runtime event pushed over WebSocket. */
export interface RuntimeEvent {
  type: RuntimeEventType
  payload?: Record<string, unknown>
  timestamp: string
}

/** Project summary returned by project.list. */
export interface ProjectSummary {
  projectId: string
  name: string
  path: string
  protocolVersion: string
  health: 'healthy' | 'degraded' | 'readonly'
  activeRunId?: string
}

/** DTO for current run state. */
export interface RunStateDto {
  runId: string
  intent: string
  risk: string
  status: string
  currentNode: string
  completedNodes: string[]
  requiredNodes: string[]
}

/** Diagnostic from workflow compilation. */
export interface WorkflowDiagnostic {
  code: string
  severity: 'error' | 'warning'
  pointer: string
  message: string
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

export interface WorkflowNode {
  id: string
  role: string
  artifact: string
  gates: string[]
}

export interface ExecutionDecision {
  requestId: number
  decision: 'allow_once' | 'allow_session' | 'deny' | 'cancel'
}

export interface HarnessApi {
  health: () => Promise<Record<string, unknown>>
  listProjects: () => Promise<ProjectSummary[] | { error: string }>
  importProject: (path: string) => Promise<ProjectSummary | { error: string }>
  validateProject: (path: string) => Promise<Record<string, unknown>>
  repairProject: (projectId: string) => Promise<Record<string, unknown>>
  unregisterProject: (projectId: string) => Promise<Record<string, unknown>>
  relocateProject: (projectId: string) => Promise<Record<string, unknown>>
  listRuns: (projectId: string) => Promise<RunSummary[] | { error: string }>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  archiveRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  getRunExecutionContext: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  completeNode: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  confirmNode: (projectId: string, runId: string, decision: 'accept' | 'reject' | 'defer', comment: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  rejectNode: (projectId: string, runId: string, comment: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  getWorkflow: (projectId: string, runId?: string) => Promise<Record<string, unknown>>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<Record<string, unknown>>
  previewWorkflow: (projectId: string, nodes: WorkflowNode[], intent: string, risk: string, route: string[], options?: Record<string, unknown>) => Promise<Record<string, unknown>>
  diffWorkflow: (projectId: string, yaml: string) => Promise<Record<string, unknown>>
  previewWorkflowYaml: (projectId: string, yaml: string) => Promise<Record<string, unknown>>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<Record<string, unknown>>
  importWorkflow: (projectId: string) => Promise<Record<string, unknown>>
  exportWorkflow: (projectId: string, format: 'yaml' | 'zip') => Promise<Record<string, unknown>>
  listWorkflowVersions: (projectId: string) => Promise<unknown>
  restoreWorkflowVersion: (projectId: string, versionId: number, expectedHash: string) => Promise<Record<string, unknown>>
  listGates: (projectId: string, runId: string) => Promise<Record<string, unknown>>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  waiveGate: (projectId: string, runId: string, gateId: string, scope: string, reason: string, owner: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  hashArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  getCodexSettings: () => Promise<CodexSettings | { error: string } | undefined>
  discoverCodex: () => Promise<Record<string, unknown>>
  selectCodexExecutable: () => Promise<Record<string, unknown>>
  createTerminal: (request: TerminalCreateRequest) => Promise<TerminalSessionSummary>
  listTerminals: (projectId: string) => Promise<TerminalSessionSummary[]>
  writeTerminal: (sessionId: string, data: string) => Promise<void>
  getTerminalScrollback: (sessionId: string) => Promise<{ data: string; sequence: number }>
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>
  stopTerminal: (sessionId: string) => Promise<TerminalSessionSummary>
  restartTerminal: (sessionId: string) => Promise<TerminalSessionSummary>
  onTerminalData: (callback: (event: TerminalEvent) => void) => () => void
  onTerminalExit: (callback: (event: TerminalEvent) => void) => () => void
  onTerminalStatus: (callback: (event: TerminalEvent) => void) => () => void
  exportDiagnostics: (projectId: string) => Promise<Record<string, unknown>>
  listKnowledge: (projectId: string, status: string) => Promise<unknown>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<unknown>
  probeExecution: (projectId: string) => Promise<Record<string, unknown>>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: ExecutionDecision) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown>
  cleanupRecovery: (projectId: string) => Promise<unknown>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void
}
