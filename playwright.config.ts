import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, SERVER_ENV } from './apps/web/tests/e2e/server-env.ts'

export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  testMatch: '*.e2e.ts',
  outputDir: 'test-results',
  forbidOnly: true,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    // ci only shows a bare timeout, so keep the trace of anything that fails there
    trace: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 360, height: 740 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  // flask serves the built app here, the same shape as the deployed container
  webServer: {
    command: 'bun run start',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: SERVER_ENV,
  },
})
