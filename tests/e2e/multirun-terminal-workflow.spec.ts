import { expect, test, type Page } from '@playwright/test'

const runs = [
  { run_id: 'run-a', intent: 'FEATURE', risk: 'HIGH', status: 'DEVELOPING', current_node: 'DEVELOPMENT', next_role: 'developer', completed_nodes: ['INTAKE'], required_nodes: ['INTAKE', 'DEVELOPMENT', 'COMPILE'], blocked_by: [], phase_dir: '.harness/phases/run-a', active: true, revision: 'rev-a', worktree_path: 'G:/worktrees/run-a' },
  { run_id: 'run-b', intent: 'BUG_FIX', risk: 'MEDIUM', status: 'DEVELOPING', current_node: 'DEVELOPMENT', next_role: 'developer', completed_nodes: ['INTAKE'], required_nodes: ['INTAKE', 'DEVELOPMENT', 'COMPILE'], blocked_by: [], phase_dir: '.harness/phases/run-b', active: false, revision: 'rev-b', worktree_path: 'G:/worktrees/run-b' },
]

async function installBridge(page: Page): Promise<void> {
  await page.addInitScript(({ fixtureRuns }) => {
    const api = {
      health: async () => ({ status: 'healthy' }),
      onRuntimeEvent: () => () => {},
      listProjects: async () => [{ projectId: 'project-a', name: 'Project A', path: 'G:/project-a', protocolVersion: '1.0', health: 'healthy' }],
      listRuns: async () => fixtureRuns,
      switchRun: async (_projectId: string, runId: string) => ({ run: fixtureRuns.find((run) => run.run_id === runId), revision: `rev-${runId}` }),
      listTerminals: async () => [{ sessionId: 'session-b', projectId: 'project-a', runId: 'run-b', nodeId: 'DEVELOPMENT', kind: 'codex', executablePath: 'C:/codex.exe', cwd: 'G:/worktrees/run-b', status: 'running', startedAt: '2026-07-24T00:00:00Z', cols: 100, rows: 30, sequence: 2, summary: '' }],
      getTerminalScrollback: async () => ({ data: '', sequence: 2 }),
      writeTerminal: async () => undefined,
      resizeTerminal: async () => undefined,
      onTerminalData: () => () => {}, onTerminalExit: () => () => {}, onTerminalStatus: () => () => {},
      getRunExecutionContext: async (_projectId: string, runId: string) => ({ runId, revision: `rev-${runId}`, status: 'DEVELOPING', currentNode: 'DEVELOPMENT', nextRole: 'developer', phaseDir: `.harness/phases/${runId}`, worktreePath: `G:/worktrees/${runId}`, terminalAllowed: true }),
      getWorkflow: async (_projectId: string, runId: string) => ({
        nodes: [{ id: 'INTAKE', role: 'dispatcher', artifact: '00-intake.md', gates: [] }, { id: 'DEVELOPMENT', role: 'developer', artifact: '11-development.md', gates: [] }],
        routes: { FEATURE: { HIGH: ['INTAKE', 'DEVELOPMENT'] }, BUG_FIX: { MEDIUM: ['INTAKE', 'DEVELOPMENT'] } },
        state: { run_id: runId, status: 'DEVELOPING', intent: 'FEATURE', risk: 'HIGH', current_node: 'DEVELOPMENT', completed_nodes: ['INTAKE'], required_nodes: ['INTAKE', 'DEVELOPMENT'] },
        roles: ['dispatcher', 'developer'], gate_definitions: { G3_COMPILE: { required_artifacts: ['12-compile.md'] } }, gate_meanings: {}, hard_rules: {}, effective_hard_rules: { code_changed_requires: ['DEVELOPMENT'] }, failure_recovery: { max_auto_retries_per_gate: 2, gate_to_node: {} }, yaml: 'schema_version: "1.0"', hash: 'workflow-hash',
      }),
      listWorkflowVersions: async () => [],
    }
    Object.defineProperty(window, 'harness', { value: api, configurable: true })
    localStorage.setItem('harness.selectedProjectId', 'project-a')
  }, { fixtureRuns: runs })
}

test('switching selected run reveals its independent active terminal', async ({ page }) => {
  await installBridge(page)
  await page.goto('/#/runs')
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible()
  await page.getByRole('row', { name: /run-b/ }).click()
  await page.getByTitle('Open running terminal').click()

  await expect(page.getByRole('heading', { name: 'Terminal' })).toBeVisible()
  await expect(page.getByText('run-b', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('G:/worktrees/run-b')).toBeVisible()
  await expect(page.getByText('running', { exact: true })).toBeVisible()
})

test('workflow studio exposes routes, recovery, rules, yaml and versions', async ({ page }) => {
  await installBridge(page)
  await page.goto('/#/workflow')
  await expect(page.getByRole('heading', { name: 'Workflow Studio' })).toBeVisible()
  const tabs = page.locator('.studio-tabs')
  for (const tab of ['Routes', 'Nodes', 'Recovery', 'Rules', 'YAML', 'Versions']) {
    await expect(tabs.getByRole('button', { name: tab, exact: true })).toBeVisible()
  }
  await tabs.getByRole('button', { name: 'Rules', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Effective hard rules' })).toBeVisible()
})
