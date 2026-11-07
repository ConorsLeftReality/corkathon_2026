import { describe, expect, it } from 'bun:test'
import { askResponseSchema } from '#src/features/radar/radar-api.ts'

const snapshot = { fetched_at: '2026-11-07T09:12:00Z', newest_reg_date: '2026-11-06', stale: false }

const row = {
  company_num: '123456',
  company_name: 'Placeholder Bakery Limited',
  sector_label: 'Food and beverage service',
  routing_key: 'T12',
  filing_deadline: '2026-06-20',
  days_to_deadline: -140,
  days_overdue: 140,
  est_penalty_eur: 520,
}

describe('askResponseSchema', () => {
  it('reads an answer with rows, filter and sql', () => {
    const parsed = askResponseSchema.parse({
      kind: 'answer',
      answer: '1 company is overdue.',
      rows: [row],
      filter: { action: 'query', mode: 'prospects', overdue_only: true },
      sql: 'SELECT 1',
      params: ['2026-11-07', 56],
      row_count: 1,
      snapshot,
    })
    expect(parsed.kind).toBe('answer')
  })

  it('reads a clarifying question with no rows', () => {
    const parsed = askResponseSchema.parse({
      kind: 'clarify',
      message: 'Which area should I look in?',
      snapshot,
    })
    expect(parsed.kind).toBe('clarify')
  })

  it('accepts a company with no eircode or sector', () => {
    const parsed = askResponseSchema.parse({
      kind: 'answer',
      answer: '',
      rows: [{ ...row, routing_key: null, sector_label: null }],
      filter: {},
      sql: '',
      params: [],
      row_count: 1,
      snapshot,
    })
    expect(parsed.kind === 'answer' && parsed.rows[0]?.routing_key).toBeNull()
  })

  it('rejects a kind the page does not know how to show', () => {
    expect(askResponseSchema.safeParse({ kind: 'guess', snapshot }).success).toBe(false)
  })

  it('rejects a deadline that is not an iso date', () => {
    const result = askResponseSchema.safeParse({
      kind: 'answer',
      answer: '',
      rows: [{ ...row, filing_deadline: '20/06/2026' }],
      filter: {},
      sql: '',
      params: [],
      row_count: 1,
      snapshot,
    })
    expect(result.success).toBe(false)
  })
})
