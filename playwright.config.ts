import { defineConfig } from '@playwright/test'

// Playwright E2E configuration — skeleton for Phase 7 end-to-end tests
// M1 does not run E2E; this file establishes the config baseline.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
