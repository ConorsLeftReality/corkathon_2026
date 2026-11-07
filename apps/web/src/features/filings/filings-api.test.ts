import { describe, expect, it } from 'bun:test'
import { ApiError } from '#src/api/api-client.ts'
import { createFilingsClient, reportSchema } from '#src/features/filings/filings-api.ts'

const company = {
  company_num: '123456',
  company_name: 'Placeholder Pharmacy Limited',
  company_status: 'Normal',
  company_type: 'LTD - Private Company Limited by Shares',
  address: '1 Placeholder Street, Cork',
  last_ar_date: '2025-10-01',
  nard: '2026-09-01',
  deadline: '2026-10-27',
  days_left: -11,
  status: 'overdue',
}

const report = {
  generated_at: '2026-11-07T09:12:00',
  as_of: '2026-11-07',
  window_days: 30,
  grace_days: 56,
  counts: { overdue: 1, due: 0, ok: 0, unknown: 0, dissolved: 0, not_found: 0 },
  companies: [company],
  source: 'Contains data from the Companies Registration Office (CRO), licensed under CC BY 4.0.',
}

function respond(status: number, body: unknown, type = 'application/json') {
  return () =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': type },
      }),
    )
}

describe('reportSchema', () => {
  it('reads the report the flask api writes', () => {
    expect(reportSchema.parse(report).companies[0]?.status).toBe('overdue')
  })

  it('accepts a company the snapshot did not have', () => {
    const missing = {
      ...company,
      company_name: '',
      nard: null,
      deadline: null,
      days_left: null,
      last_ar_date: null,
      status: 'not_found',
    }
    expect(reportSchema.safeParse({ ...report, companies: [missing] }).success).toBe(true)
  })

  it('rejects a status the page does not know', () => {
    const odd = { ...company, status: 'late' }
    expect(reportSchema.safeParse({ ...report, companies: [odd] }).success).toBe(false)
  })
})

describe('createFilingsClient', () => {
  it('returns the parsed report', async () => {
    const client = createFilingsClient(respond(200, report))
    expect((await client.fetchReport()).as_of).toBe('2026-11-07')
  })

  it('turns the flask error string into a readable error', async () => {
    const client = createFilingsClient(
      respond(500, { error: 'Company list not found: my_companies.csv' }),
    )
    const error = await client.fetchReport().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('Company list not found: my_companies.csv')
    expect((error as ApiError).code).toBe('filings_error')
  })

  it('says so when the filings api is not running', async () => {
    const client = createFilingsClient(() => Promise.reject(new TypeError('fetch failed')))
    const error = await client.fetchReport().catch((caught: unknown) => caught)
    expect((error as ApiError).code).toBe('network_error')
  })

  it('reports a response it cannot read', async () => {
    const client = createFilingsClient(respond(200, { companies: 'nope' }))
    const error = await client.fetchReport().catch((caught: unknown) => caught)
    expect((error as ApiError).code).toBe('bad_response')
  })

  it('reads the briefing as plain text', async () => {
    const client = createFilingsClient(
      respond(200, 'Filing briefing for 7 November 2026.', 'text/plain'),
    )
    expect(await client.fetchBriefing()).toBe('Filing briefing for 7 November 2026.')
  })
})

describe('createFilingsClient with the apps/api backend', () => {
  it('reads the scaffold error envelope and keeps its code', async () => {
    const client = createFilingsClient(
      respond(503, {
        error: {
          code: 'filings_building',
          message: "Downloading today's CRO register. Try again in a minute.",
        },
      }),
    )
    const error = await client.fetchReport().catch((caught: unknown) => caught)
    expect((error as ApiError).code).toBe('filings_building')
    expect((error as ApiError).status).toBe(503)
  })

  it('sends the csrf token with a refresh', async () => {
    let sent: Headers | undefined
    const client = createFilingsClient(
      (_path, init) => {
        sent = new Headers(init?.headers)
        return respond(200, report)()
      },
      () => 'other=1; csrf_access_token=abc123',
    )
    await client.refreshReport()
    expect(sent?.get('X-CSRF-TOKEN')).toBe('abc123')
  })

  it('does not send the csrf token with a read', async () => {
    let sent: Headers | undefined
    const client = createFilingsClient(
      (_path, init) => {
        sent = new Headers(init?.headers)
        return respond(200, report)()
      },
      () => 'csrf_access_token=abc123',
    )
    await client.fetchReport()
    expect(sent?.get('X-CSRF-TOKEN')).toBeNull()
  })
})
