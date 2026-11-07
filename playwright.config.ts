import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORT = 5050
const database = join(mkdtempSync(join(tmpdir(), 'corkathon-e2e-')), 'e2e.db').replaceAll('\\', '/')

export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  testMatch: '*.e2e.ts',
  outputDir: 'test-results',
  forbidOnly: true,
  use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: 'phone', use: { viewport: { width: 360, height: 740 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  // flask serves the built app here, the same shape as the deployed container
  webServer: {
    command: 'bun run start',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      JWT_SECRET_KEY: 'e2e-only-secret-that-is-long-enough-for-hs256',
      DATABASE_URL: `sqlite:///${database}`,
      AUTH_RATE_LIMIT_PER_MINUTE: '100000',
    },
  },
})
