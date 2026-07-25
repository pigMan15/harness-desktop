import { expect, test, type Page } from '@playwright/test'

async function installBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const api = {
      health: async () => ({ status: 'healthy' }),
      onRuntimeEvent: () => () => {}, onTerminalData: () => () => {}, onTerminalExit: () => () => {}, onTerminalStatus: () => () => {},
      listProjects: async () => [], listRuns: async () => [], listTerminals: async () => [],
    }
    Object.defineProperty(window, 'harness', { value: api, configurable: true })
  })
}

test('shows a bounded launch sequence and reveals the workspace', async ({ page }, testInfo) => {
  await installBridge(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/runs')

  const splash = page.getByRole('status', { name: 'Harness Desktop is starting' })
  await expect(splash).toBeVisible()
  await expect(splash.getByRole('heading', { name: 'HARNESS' })).toBeVisible()
  await page.waitForTimeout(700)
  await page.screenshot({ path: testInfo.outputPath('launch-splash.png') })

  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth - window.innerWidth, height: document.documentElement.scrollHeight - window.innerHeight }))
  expect(overflow.width).toBeLessThanOrEqual(1)
  expect(overflow.height).toBeLessThanOrEqual(1)

  await expect(splash).toBeHidden({ timeout: 3500 })
  await expect(page.getByText('Select a project')).toBeVisible()
})

test('honors reduced motion and remains readable on a narrow viewport', async ({ page }) => {
  await installBridge(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 720, height: 720 })
  await page.goto('/#/runs')

  const splash = page.getByRole('status', { name: 'Harness Desktop is starting' })
  await expect(splash).toBeVisible()
  await expect(splash).toBeHidden({ timeout: 1200 })
})
