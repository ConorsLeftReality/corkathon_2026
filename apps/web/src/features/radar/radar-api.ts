import { z } from 'zod'
import { apiRequest } from '#src/api/api-client.ts'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const snapshotSchema = z.object({
  fetched_at: z.string(),
  newest_reg_date: isoDate,
  stale: z.boolean(),
})

const rowSchema = z.object({
  company_num: z.string(),
  company_name: z.string(),
  sector_label: z.string().nullable(),
  routing_key: z.string().nullable(),
  filing_deadline: isoDate,
  days_to_deadline: z.number().int(),
  days_overdue: z.number().int().nonnegative(),
  est_penalty_eur: z.number().nonnegative(),
})

export const askResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('answer'),
    answer: z.string(),
    rows: z.array(rowSchema),
    filter: z.record(z.string(), z.unknown()),
    sql: z.string(),
    params: z.array(z.unknown()),
    row_count: z.number().int().nonnegative(),
    snapshot: snapshotSchema,
  }),
  z.object({
    kind: z.enum(['clarify', 'refuse']),
    message: z.string(),
    snapshot: snapshotSchema,
  }),
])

export type RadarMode = 'prospects' | 'clients'
export type RadarRow = z.infer<typeof rowSchema>
export type RadarSnapshot = z.infer<typeof snapshotSchema>
export type AskResponse = z.infer<typeof askResponseSchema>
export type RadarAnswer = Extract<AskResponse, { kind: 'answer' }>

export const QUESTION_MAX_LENGTH = 300

// stored filters live on the server, so these run with no model in the path
export const PRESETS = {
  prospects: [
    {
      id: 'overdue_cork_hospitality',
      question: 'Which Cork hospitality companies are overdue on their annual return?',
    },
    { id: 'overdue_cork_city', question: 'Which Cork city companies are most overdue?' },
  ],
  clients: [
    { id: 'clients_this_week', question: 'Who do I need to chase this week?' },
    { id: 'clients_overdue', question: 'Which of my clients are overdue?' },
  ],
} as const satisfies Record<RadarMode, readonly { id: string; question: string }[]>

export type RadarRequest =
  { mode: RadarMode; question: string } | { mode: RadarMode; preset: string }

export function askRadar(request: RadarRequest): Promise<AskResponse> {
  return apiRequest('/api/radar/ask', askResponseSchema, { method: 'POST', body: request })
}

export const clientListSchema = z.object({ company_numbers: z.array(z.string()) })

export function fetchSnapshot(): Promise<RadarSnapshot> {
  return apiRequest('/api/radar/snapshot', snapshotSchema)
}

export async function fetchClientList(): Promise<string[]> {
  const { company_numbers } = await apiRequest('/api/radar/clients', clientListSchema)
  return company_numbers
}

export async function saveClientList(numbers: string[]): Promise<string[]> {
  const options = { method: 'PUT', body: { company_numbers: numbers } } as const
  const { company_numbers } = await apiRequest('/api/radar/clients', clientListSchema, options)
  return company_numbers
}
