import { z } from 'zod'
import { ApiError } from '#src/api/api-client.ts'

// served by the filings feature in apps/api, or by matteo/app.py when vite proxies to it

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const FILING_STATUSES = [
  'overdue',
  'due',
  'ok',
  'unknown',
  'dissolved',
  'not_found',
] as const

export type FilingStatus = (typeof FILING_STATUSES)[number]

const companySchema = z.object({
  company_num: z.string(),
  company_name: z.string(),
  company_status: z.string(),
  company_type: z.string(),
  address: z.string(),
  last_ar_date: isoDate.nullable(),
  nard: isoDate.nullable(),
  deadline: isoDate.nullable(),
  days_left: z.number().int().nullable(),
  status: z.enum(FILING_STATUSES),
})

export const reportSchema = z.object({
  generated_at: z.string(),
  as_of: isoDate,
  window_days: z.number().int(),
  grace_days: z.number().int(),
  counts: z.record(z.string(), z.number().int()),
  companies: z.array(companySchema),
  source: z.string(),
})

export type FilingCompany = z.infer<typeof companySchema>
export type FilingReport = z.infer<typeof reportSchema>

// apps/api sends { error: { code, message } }, matteo/app.py sends { error: message }
const errorBody = z.object({
  error: z.union([z.object({ code: z.string(), message: z.string() }), z.string()]),
})

const BAD_RESPONSE = 'The filings service sent a response we could not read. Try again.'

type Fetch = (path: string, init?: RequestInit) => Promise<Response>

function csrfToken(cookies: string): string | undefined {
  const pair = cookies.split('; ').find((cookie) => cookie.startsWith('csrf_access_token='))
  return pair?.slice('csrf_access_token='.length)
}

export function createFilingsClient(fetchImpl: Fetch, readCookies: () => string = () => '') {
  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    const token = csrfToken(readCookies())
    // the session cookie needs its csrf pair on anything that is not a read
    if (init.method !== undefined && init.method !== 'GET' && token) {
      headers.set('X-CSRF-TOKEN', token)
    }
    const response = await fetchImpl(path, { ...init, headers }).catch(() => {
      throw new ApiError(
        'network_error',
        'Could not reach the filings service. Check that it is running and try again.',
        0,
      )
    })
    if (!response.ok) {
      const parsed = errorBody.safeParse(await response.json().catch((): unknown => null))
      if (!parsed.success) throw new ApiError('bad_response', BAD_RESPONSE, response.status)
      const { error } = parsed.data
      throw typeof error === 'string'
        ? new ApiError('filings_error', error, response.status)
        : new ApiError(error.code, error.message, response.status)
    }
    return response
  }

  async function readReport(path: string, init?: RequestInit): Promise<FilingReport> {
    const response = await send(path, init)
    const parsed = reportSchema.safeParse(await response.json().catch((): unknown => null))
    if (!parsed.success) throw new ApiError('bad_response', BAD_RESPONSE, response.status)
    return parsed.data
  }

  return {
    fetchReport: () => readReport('/api/report'),
    // rebuilds from the csv and may download a fresh cro snapshot, so it can take a while
    refreshReport: () => readReport('/api/refresh', { method: 'POST' }),
    fetchBriefing: async () => (await send('/api/briefing')).text(),
  }
}

export const filingsApi = createFilingsClient(
  (path, init) => fetch(path, init),
  () => document.cookie,
)
