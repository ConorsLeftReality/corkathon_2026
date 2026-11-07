import { z } from 'zod'
import { ApiError } from '#src/api/api-client.ts'

// the filings api is matteo/app.py, a separate flask app that vite proxies to

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

const flaskError = z.object({ error: z.string() })

const BAD_RESPONSE = 'The filings service sent a response we could not read. Try again.'

type Fetch = (path: string, init?: RequestInit) => Promise<Response>

export function createFilingsClient(fetchImpl: Fetch) {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetchImpl(path, init).catch(() => {
      throw new ApiError(
        'network_error',
        'Could not reach the filings service. Check that it is running and try again.',
        0,
      )
    })
    if (!response.ok) {
      const parsed = flaskError.safeParse(await response.json().catch((): unknown => null))
      throw parsed.success
        ? new ApiError('filings_error', parsed.data.error, response.status)
        : new ApiError('bad_response', BAD_RESPONSE, response.status)
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

export const filingsApi = createFilingsClient((path, init) => fetch(path, init))
