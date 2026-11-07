import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// dev only stand in for the radar api, the contract lives in docs/02-architecture.md
// every company here is made up and named Placeholder so nobody mistakes it for register data

type Reply = { status: number; body: unknown; text?: boolean }

const snapshot = { fetched_at: '2026-11-07T09:12:00Z', newest_reg_date: '2026-11-06', stale: false }

type Row = {
  company_num: string
  company_name: string
  sector_label: string | null
  routing_key: string | null
  filing_deadline: string
  days_to_deadline: number
  days_overdue: number
  est_penalty_eur: number
}

function overdueRow(
  num: string,
  name: string,
  sector: string,
  key: string | null,
  days: number,
  deadline: string,
): Row {
  return {
    company_num: num,
    company_name: name,
    sector_label: sector,
    routing_key: key,
    filing_deadline: deadline,
    days_to_deadline: -days,
    days_overdue: days,
    est_penalty_eur: Math.min(100 + 3 * days, 1200),
  }
}

function dueRow(
  num: string,
  name: string,
  sector: string,
  key: string,
  days: number,
  deadline: string,
): Row {
  return {
    company_num: num,
    company_name: name,
    sector_label: sector,
    routing_key: key,
    filing_deadline: deadline,
    days_to_deadline: days,
    days_overdue: 0,
    est_penalty_eur: 0,
  }
}

const BAKERY = overdueRow(
  '600001',
  'Placeholder Bakery Limited',
  'Food and beverage service',
  'T12',
  420,
  '2025-09-13',
)

const QUAY_CAFE = overdueRow(
  '600003',
  'Placeholder Quay Cafe Limited',
  'Food and beverage service',
  'T12',
  96,
  '2026-08-03',
)

const HOSPITALITY: Row[] = [
  BAKERY,
  overdueRow('600002', 'Placeholder Harbour Hotel DAC', 'Accommodation', 'P43', 140, '2026-06-20'),
  QUAY_CAFE,
  overdueRow(
    '600004',
    'Placeholder Lane Bistro Limited',
    'Food and beverage service',
    'T23',
    61,
    '2026-09-07',
  ),
  overdueRow('600005', 'Placeholder Guesthouse Limited', 'Accommodation', 'P72', 33, '2026-10-05'),
  overdueRow(
    '600006',
    'Placeholder Catering Company Limited',
    'Food and beverage service',
    null,
    9,
    '2026-10-29',
  ),
]

const CITY: Row[] = [
  BAKERY,
  overdueRow(
    '600011',
    'Placeholder Motors Limited',
    'Wholesale and retail trade',
    'T12',
    205,
    '2026-04-16',
  ),
  overdueRow('600012', 'Placeholder Build Limited', 'Construction', 'T23', 118, '2026-07-12'),
  QUAY_CAFE,
]

const CLIENTS_OVERDUE: Row[] = [
  overdueRow('700001', 'Placeholder Pharmacy Limited', 'Retail trade', 'T12', 12, '2026-10-26'),
  overdueRow(
    '700002',
    'Placeholder Studios Limited',
    'Information and communication',
    'T23',
    3,
    '2026-11-04',
  ),
]

const CLIENTS_WEEK: Row[] = [
  dueRow('700003', 'Placeholder Dental Limited', 'Human health activities', 'T12', 3, '2026-11-10'),
  dueRow(
    '700004',
    'Placeholder Architects Limited',
    'Professional services',
    'T12',
    5,
    '2026-11-12',
  ),
  dueRow(
    '700005',
    'Placeholder Veterinary Limited',
    'Professional services',
    'P31',
    7,
    '2026-11-14',
  ),
]

type Canned = { answer: string; rows: Row[]; total: number; filter: Record<string, unknown> }

const PRESETS = {
  overdue_cork_hospitality: {
    answer:
      '6 Cork hospitality companies are overdue. Most overdue: Placeholder Bakery Limited, 420 days late, estimated penalty about €1,200.',
    rows: HOSPITALITY,
    total: 6,
    filter: {
      action: 'query',
      mode: 'prospects',
      overdue_only: true,
      nace_prefixes: ['55', '56'],
      area: 'cork_county',
      sort: 'most_overdue',
      limit: 10,
    },
  },
  overdue_cork_city: {
    answer:
      '23 Cork city companies are overdue. Most overdue: Placeholder Bakery Limited, 420 days late.',
    rows: CITY,
    total: 23,
    filter: {
      action: 'query',
      mode: 'prospects',
      overdue_only: true,
      area: 'cork_city',
      sort: 'most_overdue',
      limit: 4,
    },
  },
  clients_overdue: {
    answer:
      '2 of your clients are overdue. Most overdue: Placeholder Pharmacy Limited, 12 days late.',
    rows: CLIENTS_OVERDUE,
    total: 2,
    filter: {
      action: 'query',
      mode: 'clients',
      overdue_only: true,
      sort: 'most_overdue',
      limit: 10,
    },
  },
  clients_this_week: {
    answer:
      '3 of your clients have a filing deadline in the next 7 days. Soonest: Placeholder Dental Limited, due 10 Nov 2026.',
    rows: CLIENTS_WEEK,
    total: 3,
    filter: {
      action: 'query',
      mode: 'clients',
      deadline_window_days: 7,
      sort: 'deadline_soonest',
      limit: 10,
    },
  },
} satisfies Record<string, Canned>

// hasOwn so an id like toString or __proto__ never resolves to something inherited
function presetById(id: string): Canned | undefined {
  return Object.hasOwn(PRESETS, id) ? PRESETS[id as keyof typeof PRESETS] : undefined
}

const SQL = `WITH f AS (... derived fields, see docs/04-question-engine.md ...)
SELECT company_num, company_name, sector_label, routing_key, filing_deadline,
       days_to_deadline, days_overdue, est_penalty_eur, count(*) OVER () AS total
FROM f
WHERE is_live AND overdue AND routing_key IN (?, ?)
ORDER BY days_overdue DESC, company_name ASC
LIMIT ?`

function answerReply(canned: Canned): Reply {
  return {
    status: 200,
    body: {
      kind: 'answer',
      answer: canned.answer,
      rows: canned.rows,
      filter: canned.filter,
      sql: SQL,
      params: ['2026-11-07', 56, 'T12', 'T23', canned.filter.limit ?? 10],
      row_count: canned.total,
      snapshot,
    },
  }
}

function error(status: number, code: string, message: string): Reply {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function ask(body: unknown): Reply {
  if (!isRecord(body)) return error(400, 'radar_question_invalid', 'Send a question or a preset.')
  if (typeof body.preset === 'string') {
    const canned = presetById(body.preset)
    return canned
      ? answerReply(canned)
      : error(400, 'radar_question_invalid', 'That example question does not exist.')
  }
  if (typeof body.question !== 'string' || body.question.trim() === '') {
    return error(400, 'radar_question_invalid', 'Type a question first.')
  }
  const question = body.question.toLowerCase()
  if (/turnover|profit|revenue|accounts figures/.test(question)) {
    return {
      status: 200,
      body: {
        kind: 'refuse',
        message:
          "The register only has filing dates and status, not turnover or accounts figures. I can tell you when a company's next return is due.",
        snapshot,
      },
    }
  }
  if (/\bsoon\b/.test(question) && !/cork|t12|t23|client/.test(question)) {
    return {
      status: 200,
      body: {
        kind: 'clarify',
        message: 'Which area should I look in? For example Cork city or County Cork.',
        snapshot,
      },
    }
  }
  if (body.mode === 'clients') {
    return answerReply(
      /week|due|chase/.test(question) ? PRESETS.clients_this_week : PRESETS.clients_overdue,
    )
  }
  return answerReply(
    question.includes('city') ? PRESETS.overdue_cork_city : PRESETS.overdue_cork_hospitality,
  )
}

// the shape matteo/app.py writes to report.json
function filingCompany(
  num: string,
  name: string,
  status: string,
  nard: string | null,
  deadline: string | null,
  daysLeft: number | null,
) {
  return {
    company_num: num,
    company_name: name,
    company_status: name === '' ? '' : 'Normal',
    company_type: name === '' ? '' : 'LTD - Private Company Limited by Shares',
    address: name === '' ? '' : '1 Placeholder Street, Cork',
    last_ar_date: nard === null ? null : '2025-09-01',
    nard,
    deadline,
    days_left: daysLeft,
    status,
  }
}

const FILINGS_COMPANIES = [
  filingCompany(
    '700001',
    'Placeholder Pharmacy Limited',
    'overdue',
    '2026-08-31',
    '2026-10-26',
    -12,
  ),
  filingCompany('700002', 'Placeholder Studios Limited', 'overdue', '2026-09-09', '2026-11-04', -3),
  filingCompany('700003', 'Placeholder Dental Limited', 'due', '2026-09-15', '2026-11-10', 3),
  filingCompany('700004', 'Placeholder Architects Limited', 'due', '2026-09-17', '2026-11-12', 5),
  filingCompany('700005', 'Placeholder Veterinary Limited', 'due', '2026-10-13', '2026-12-08', 31),
  filingCompany('700006', 'Placeholder Bakery Limited', 'ok', '2027-01-20', '2027-03-17', 130),
  filingCompany('700099', '', 'not_found', null, null, null),
]

const FILINGS_REPORT = {
  generated_at: '2026-11-07T09:12:00',
  as_of: '2026-11-07',
  window_days: 30,
  grace_days: 56,
  counts: { overdue: 2, due: 3, ok: 1, unknown: 0, dissolved: 0, not_found: 1 },
  companies: FILINGS_COMPANIES,
  source: 'Contains data from the Companies Registration Office (CRO), licensed under CC BY 4.0.',
}

const FILINGS_BRIEFING = `Filing briefing for 7 November 2026.

Companies due to file
3 companies are due to file in the next 30 days.
Placeholder Dental Limited must file its annual return by 10 November 2026, which is in 3 days.
Placeholder Architects Limited must file its annual return by 12 November 2026, which is in 5 days.
Placeholder Veterinary Limited must file its annual return by 8 December 2026, which is in 31 days.

Overdue companies
2 companies are overdue.
Placeholder Pharmacy Limited missed its deadline of 26 October 2026 and is 12 days overdue.
Placeholder Studios Limited missed its deadline of 4 November 2026 and is 3 days overdue.
`

export const FILINGS_PATHS = ['/api/report', '/api/companies', '/api/briefing', '/api/refresh']

export function createRadarMock() {
  let clients: string[] = []

  function handle(method: string, path: string, body: unknown): Reply | null {
    if (path === '/api/report' && method === 'GET') return { status: 200, body: FILINGS_REPORT }
    if (path === '/api/refresh' && method === 'POST') return { status: 200, body: FILINGS_REPORT }
    if (path === '/api/companies' && method === 'GET') {
      return { status: 200, body: FILINGS_COMPANIES }
    }
    if (path === '/api/briefing' && method === 'GET') {
      return { status: 200, body: FILINGS_BRIEFING, text: true }
    }
    if (path === '/api/radar/snapshot' && method === 'GET') return { status: 200, body: snapshot }
    if (path === '/api/radar/clients' && method === 'GET')
      return { status: 200, body: { company_numbers: clients } }
    if (path === '/api/radar/clients' && method === 'PUT') {
      const numbers = isRecord(body) ? body.company_numbers : undefined
      if (!Array.isArray(numbers) || !numbers.every((n) => typeof n === 'string')) {
        return error(400, 'radar_clients_invalid', 'Send company numbers as a list of text values.')
      }
      clients = numbers
      return { status: 200, body: { company_numbers: clients } }
    }
    if (path === '/api/radar/ask' && method === 'POST') return ask(body)
    return null
  }

  return { handle }
}

// same cap as MAX_BODY_BYTES in the flask app
const BODY_MAX_BYTES = 1024 * 1024

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > BODY_MAX_BYTES) return undefined
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

// apply serve keeps it out of every production build
export function radarMock(): Plugin {
  const mock = createRadarMock()
  return {
    name: 'radar-mock',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = (req.url ?? '').split('?')[0] ?? ''
        if (!path.startsWith('/api/radar/') && !FILINGS_PATHS.includes(path)) {
          next()
          return
        }
        void readBody(req).then((body) => {
          const reply =
            mock.handle(req.method ?? 'GET', path, body) ?? error(404, 'not_found', 'Not Found.')
          // a short pause so loading states show the way they will against the real api
          setTimeout(() => {
            res.statusCode = reply.status
            if (reply.text && typeof reply.body === 'string') {
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end(reply.body)
              return
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(reply.body))
          }, 400)
        })
      })
    },
  }
}
