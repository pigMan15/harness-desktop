export interface HarnessApi {
  health: () => Promise<Record<string, unknown>>
  listProjects: () => Promise<unknown>
  importProject: (path: string) => Promise<unknown>
  validateProject: (path: string) => Promise<unknown>
  listRuns: (projectId: string) => Promise<unknown>
  createRun: (projectId: string, intent: string, risk: string, runId: string, expectedRevision?: string) => Promise<unknown>
  switchRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  pauseRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  resumeRun: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  getWorkflow: (projectId: string) => Promise<unknown>
  compileWorkflow: (projectId: string, intent: string, risk: string) => Promise<unknown>
  previewWorkflow: (projectId: string, nodes: unknown[], intent: string, risk: string, route: string[]) => Promise<unknown>
  diffWorkflow: (projectId: string, yaml: string) => Promise<unknown>
  applyWorkflow: (projectId: string, yaml: string, expectedHash: string) => Promise<unknown>
  listGates: (projectId: string, runId: string) => Promise<unknown>
  evaluateGate: (projectId: string, runId: string, gateId: string, expectedRevision?: string) => Promise<unknown>
  listArtifacts: (projectId: string, runId: string) => Promise<unknown>
  readArtifact: (projectId: string, runId: string, filename: string) => Promise<unknown>
  listKnowledge: (projectId: string, status: string) => Promise<unknown>
  reviewKnowledge: (projectId: string, candidateId: number, decision: string) => Promise<unknown>
  probeExecution: (projectId: string) => Promise<unknown>
  startExecution: (projectId: string, runId: string, expectedRevision?: string) => Promise<unknown>
  pollExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  respondExecution: (projectId: string, runId: string, sessionId: string, decision: unknown) => Promise<unknown>
  cancelExecution: (projectId: string, runId: string, sessionId: string) => Promise<unknown>
  scanRecovery: (projectId: string) => Promise<unknown>
  cleanupRecovery: (projectId: string) => Promise<unknown>
  onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => void
}
