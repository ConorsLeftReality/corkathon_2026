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
    'company_num,company_name,company_status,company_reg_date,nard,nace_v2_code,eircode,company_address_4',
    '700001,E2E OVERDUE LIMITED,Normal,2020-01-01,2026-09-01,,T23AB12,CORK',
    '700002,E2E DUE LIMITED,Normal,2020-01-01,2026-09-20,,,GALWAY',
    '700003,E2E FINE LIMITED,Normal,2026-11-06,2027-01-01,,,DUBLIN',
    '700010,E2E HARBOUR CAFE LIMITED,Normal,2019-01-01,2026-03-01,56.10,T12AB12,CORK',
  ].join('\n'),
)

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
      // the fixture snapshot is tiny, so the register index is built inside the first request
      FILINGS_BUILD_IN_BACKGROUND: 'false',
      // every test account is on example.com, so anything else proves the list is checked
      ALLOWED_EMAILS: '@example.com',
    },
  },
})
