import { describe, expect, it } from 'bun:test'
import { createRadarMock } from './radar-mock.ts'
import {
  askResponseSchema,
  clientListSchema,
  snapshotSchema,
} from '#src/features/radar/radar-api.ts'
import { reportSchema } from '#src/features/filings/filings-api.ts'

describe('radar mock', () => {
  it('serves a snapshot that meets the contract', () => {
    const mock = createRadarMock()
    const reply = mock.handle('GET', '/api/radar/snapshot', undefined)
    expect(reply?.status).toBe(200)
    expect(snapshotSchema.safeParse(reply?.body).success).toBe(true)
  })

  it('remembers a saved client list', () => {
    const mock = createRadarMock()
    mock.handle('PUT', '/api/radar/clients', { company_numbers: ['700001', '700002'] })
    const reply = mock.handle('GET', '/api/radar/clients', undefined)
    expect(clientListSchema.parse(reply?.body).company_numbers).toEqual(['700001', '700002'])
  })

  it('rejects a client list that is not a list of strings', () => {
    const mock = createRadarMock()
    const reply = mock.handle('PUT', '/api/radar/clients', { company_numbers: [700001] })
    expect(reply?.status).toBe(400)
  })

  it('answers every stored question in a shape the page can read', () => {
    const mock = createRadarMock()
    for (const preset of [
      'overdue_cork_hospitality',
      'overdue_cork_city',
      'clients_this_week',
      'clients_overdue',
    ]) {
      const reply = mock.handle('POST', '/api/radar/ask', { mode: 'clients', preset })
      expect(askResponseSchema.parse(reply?.body).kind).toBe('answer')
    }
  })

  it('refuses a question about turnover, as the real engine does', () => {
    const mock = createRadarMock()
    const reply = mock.handle('POST', '/api/radar/ask', {
      mode: 'prospects',
      question: "What's Acme's turnover?",
    })
    expect(askResponseSchema.parse(reply?.body).kind).toBe('refuse')
  })

  it('answers a free text question with placeholder rows', () => {
    const mock = createRadarMock()
    const reply = mock.handle('POST', '/api/radar/ask', {
      mode: 'prospects',
      question: 'overdue cork restaurants',
    })
    const parsed = askResponseSchema.parse(reply?.body)
    expect(parsed.kind === 'answer' && parsed.rows.length).toBeGreaterThan(0)
  })

  it('rejects an unknown stored question id', () => {
    const mock = createRadarMock()
    for (const preset of ['drop_table', 'toString', '__proto__']) {
      const reply = mock.handle('POST', '/api/radar/ask', { mode: 'prospects', preset })
      expect(reply?.status).toBe(400)
    }
  })

  it('leaves every other route to flask', () => {
    const mock = createRadarMock()
    expect(mock.handle('GET', '/api/notes', undefined)).toBeNull()
  })
})

describe('filings mock', () => {
  it('serves a report in the shape matteo/app.py writes', () => {
    const reply = createRadarMock().handle('GET', '/api/report', undefined)
    expect(reportSchema.safeParse(reply?.body).success).toBe(true)
  })

  it('serves the same report after a refresh', () => {
    const reply = createRadarMock().handle('POST', '/api/refresh', undefined)
    expect(reportSchema.safeParse(reply?.body).success).toBe(true)
  })

  it('serves the briefing as plain text', () => {
    const reply = createRadarMock().handle('GET', '/api/briefing', undefined)
    expect(reply?.text).toBe(true)
    expect(String(reply?.body)).toStartWith('Filing briefing for')
  })
})
