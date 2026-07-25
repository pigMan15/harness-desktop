import { expect, test, type Page } from '@playwright/test'

async function installBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const run = {
      run_id: 'artifact-review-20260725', intent: 'FEATURE', risk: 'MEDIUM', status: 'DONE',
      current_node: 'KNOWLEDGE_PROMOTION', next_role: 'knowledge-keeper', completed_nodes: ['INTAKE', 'DEVELOPMENT'],
      required_nodes: ['INTAKE', 'DEVELOPMENT'], blocked_by: [], phase_dir: '.harness/phases/artifact-review-20260725',
      active: true, revision: 'artifact-rev',
    }
    const files = [
      { name: '00-intake.md', size: 860, mtime: 1, type: 'markdown' },
      { name: '15-evidence.json', size: 2048, mtime: 2, type: 'json' },
      { name: 'runtime.log', size: 24 * 1024, mtime: 3, type: 'binary' },
    ]
    const contents: Record<string, string> = {
      '00-intake.md': '# Intake\n\nReview the **confirmed** request.\n\n- Scope\n- Acceptance',
      '15-evidence.json': '{\n  "status": "PASS"\n}',
      'runtime.log': 'runtime output',
    }
    const api = {
      health: async () => ({ status: 'healthy' }),
      onRuntimeEvent: () => () => {}, onTerminalData: () => () => {}, onTerminalExit: () => () => {}, onTerminalStatus: () => () => {},
      listProjects: async () => [{ projectId: 'project-a', name: 'Project A', path: 'G:/project-a', protocolVersion: '1.0', health: 'healthy' }],
      listRuns: async () => [run], listTerminals: async () => [],
      listArtifacts: async () => files,
      readArtifact: async (_projectId: string, _runId: string, filename: string) => ({
        ...files.find((file) => file.name === filename), content: contents[filename], sha256: 'a'.repeat(64), truncated: false,
      }),
    }
    Object.defineProperty(window, 'harness', { value: api, configurable: true })
    localStorage.setItem('harness.selectedProjectId', 'project-a')
    localStorage.setItem('harness.selectedRunId.project-a', run.run_id)
  })
}

test.beforeEach(async ({ page }) => {
  await installBridge(page)
  await page.goto('/#/artifacts')
  await expect(page.getByRole('heading', { name: 'Artifacts' })).toBeVisible()
})

test('supports artifact browsing and preview modes', async ({ page }) => {
  await expect(page.locator('.artifact-row.selected')).toContainText('00-intake.md')
  await expect(page.locator('.artifact-document').getByRole('heading', { name: 'Intake' })).toBeVisible()

  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  await expect(page.locator('.artifact-row')).toHaveCount(1)
  await page.locator('.artifact-row').click()
  await expect(page.locator('.artifact-source')).toContainText('"status": "PASS"')

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByRole('button', { name: /00-intake\.md/ }).click()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('.artifact-source')).toContainText('# Intake')
})

test('keeps the reader beside the browser on desktop and stacks it on narrow screens', async ({ page }) => {
  const desktop = await page.locator('.artifacts-workbench').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(desktop.split(' ')).toHaveLength(2)

  await page.setViewportSize({ width: 820, height: 900 })
  const narrow = await page.locator('.artifacts-workbench').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(narrow.split(' ')).toHaveLength(1)
  await expect(page.locator('.artifact-reader')).toBeVisible()
})
