import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('valid and invalid harness fixtures are available for project import scenarios', async () => {
  expect(existsSync(resolve('fixtures/harness-v1/valid-project/.harness/state.json'))).toBeTruthy()
  expect(existsSync(resolve('fixtures/harness-v1/invalid-duplicate-node/.harness/workflow.yaml'))).toBeTruthy()
})

test('renderer entry keeps a root mount point and CSP for desktop smoke scenarios', async ({ page }) => {
  await page.goto(`file://${resolve('apps/renderer/index.html')}`)

  await expect(page.locator('#root')).toHaveCount(1)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
})
