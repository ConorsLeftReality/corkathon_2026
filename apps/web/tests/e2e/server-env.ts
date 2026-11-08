import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PORT = 5050
export const BASE_URL = `http://127.0.0.1:${PORT}`
export const FILINGS_AS_OF = '2026-11-07'

// the config is loaded again in every worker, and workers inherit the runner's env,
// so the first load picks the folder and the rest reuse it
process.env.CORKATHON_E2E_SCRATCH ??= mkdtempSync(join(tmpdir(), 'corkathon-e2e-'))
const scratch = process.env.CORKATHON_E2E_SCRATCH
const database = join(scratch, 'e2e.db').replaceAll('\\', '/')

// a tiny snapshot so the filings routes never download the real 47 MB cro file in tests
// the app reads it as a plain csv because it is not really a zip
const filings = join(scratch, 'filings')
mkdirSync(filings, { recursive: true })
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

export const SERVER_ENV = {
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
  // as in production, so every sign-up goes through a real invite link
  INVITES_REQUIRED: 'true',
  SITE_URL: BASE_URL,
}

// runs the same command an admin runs on the pi and returns the link's path
export function invitePath(email: string): string {
  const output = execFileSync(
    'uv',
    ['run', '--directory', 'apps/api', 'python', '-m', 'corkathon_api.invites', 'create', email],
    { env: { ...process.env, ...SERVER_ENV }, encoding: 'utf8' },
  )
  const link = output.trim().split('\n').at(-1) ?? ''
  return link.slice(BASE_URL.length)
}
