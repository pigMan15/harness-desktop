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
}

export interface WorkflowNode { id: string; role: string; artifact: string; gates: string[] }
export interface ExecutionDecision { requestId: number; decision: 'allow_once' | 'allow_session' | 'deny' | 'cancel' }
type ApiObject = Record<string, unknown> & { error?: string }

export interface HarnessApi {
  health: () => Promise<ApiObject>
  listProjects: () => Promise<ProjectSummary[] | { error: string }>
  importProject: (path: string) => Promise<ProjectSummary | { error: string }>
  validateProject: (path: string) => Promise<ApiObject>
  listRuns: (projectId: string) => Promise<RunSummary[] | { error: string }>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  getWorkflow: (projectId: string) => Promise<ApiObject>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<ApiObject>
  previewWorkflow: (projectId: string, nodes: WorkflowNode[], intent: string, risk: string, route: string[]) => Promise<ApiObject>
  diffWorkflow: (projectId: string, yaml: string) => Promise<ApiObject>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<ApiObject>
  listGates: (projectId: string, runId: string) => Promise<ApiObject>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<ApiObject>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown[] | { error: string }>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<ApiObject>
  listKnowledge: (projectId: string, status: string) => Promise<unknown[] | { error: string }>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<ApiObject>
  probeExecution: (projectId: string) => Promise<ApiObject>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<ApiObject>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: ExecutionDecision) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown[] | { error: string }>
  cleanupRecovery: (projectId: string) => Promise<string[] | { error: string }>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global { interface Window { harness?: HarnessApi } }
