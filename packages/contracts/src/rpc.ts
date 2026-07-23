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
}

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
  listRuns: (projectId: string) => Promise<RunSummary[] | { error: string }>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  getWorkflow: (projectId: string) => Promise<Record<string, unknown>>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<Record<string, unknown>>
  previewWorkflow: (projectId: string, nodes: WorkflowNode[], intent: string, risk: string, route: string[]) => Promise<Record<string, unknown>>
  diffWorkflow: (projectId: string, yaml: string) => Promise<Record<string, unknown>>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<Record<string, unknown>>
  listGates: (projectId: string, runId: string) => Promise<Record<string, unknown>>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  listKnowledge: (projectId: string, status: string) => Promise<unknown>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<unknown>
  probeExecution: (projectId: string) => Promise<Record<string, unknown>>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<Record<string, unknown>>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: ExecutionDecision) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown>
  cleanupRecovery: (projectId: string) => Promise<unknown>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => void
}
