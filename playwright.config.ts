import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORT = 5050
const scratch = mkdtempSync(join(tmpdir(), 'corkathon-e2e-'))
const database = join(scratch, 'e2e.db').replaceAll('\\', '/')

// a tiny snapshot so the filings routes never download the real 47 MB cro file in tests
// the app reads it as a plain csv because it is not really a zip
const FILINGS_AS_OF = '2026-11-07'
const filings = join(scratch, 'filings')
mkdirSync(filings)
writeFileSync(
  join(filings, `cro_companies_${FILINGS_AS_OF}.csv.zip`),
  [
    'company_num,company_name,company_status,nard',
    '700001,E2E OVERDUE LIMITED,Normal,2026-09-01',
    '700002,E2E DUE LIMITED,Normal,2026-09-20',
    '700003,E2E FINE LIMITED,Normal,2027-01-01',
  ].join('\n'),
)
writeFileSync(join(filings, 'my_companies.csv'), 'company_num\n700001\n700002\n700003\n')

export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  testMatch: '*.e2e.ts',
  outputDir: 'test-results',
  forbidOnly: true,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
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
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      JWT_SECRET_KEY: 'e2e-only-secret-that-is-long-enough-for-hs256',
      DATABASE_URL: `sqlite:///${database}`,
      AUTH_RATE_LIMIT_PER_MINUTE: '100000',
      FILINGS_DATA_DIR: filings,
      FILINGS_AS_OF,
    },
  },
})
