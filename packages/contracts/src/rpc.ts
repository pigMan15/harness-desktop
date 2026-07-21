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
