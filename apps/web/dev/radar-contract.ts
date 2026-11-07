import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import {
  askResponseSchema,
  clientListSchema,
  PRESETS,
  snapshotSchema,
} from '#src/features/radar/radar-api.ts'

// checks a running radar api against the schemas the web page parses
// usage: bun run radar:contract [base url], default http://127.0.0.1:5001

export type Session = { cookie: string; csrf: string }
type Reply = { status: number; body: unknown }

export type ContractClient = {
  signUp: () => Promise<Session>
  send: (method: string, path: string, body?: unknown, session?: Session) => Promise<Reply>
}

export type CheckResult = { name: string; outcome: 'pass' | 'fail' | 'warn'; detail: string }

class CheckFailed extends Error {}

function expectStatus(reply: Reply, status: number) {
  if (reply.status !== status) {
    throw new CheckFailed(
      `expected status ${status}, got ${reply.status}: ${JSON.stringify(reply.body)}`,
    )
  }
}

function expectShape<T>(schema: z.ZodType<T>, reply: Reply): T {
  const parsed = schema.safeParse(reply.body)
  if (parsed.success) return parsed.data
  const issues = parsed.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  throw new CheckFailed(issues.join('; '))
}

const SAMPLE_NUMBERS = ['700001', '700002', '0700003']

type Check = {
  name: string
  optional?: boolean
  run: (client: ContractClient, me: Session) => Promise<string>
}

const ALL_PRESETS = [...PRESETS.prospects, ...PRESETS.clients]

const CHECKS: Check[] = [
  {
    name: 'GET /api/radar/snapshot returns the freshness gate result',
    run: async (client, me) => {
      const reply = await client.send('GET', '/api/radar/snapshot', undefined, me)
      expectStatus(reply, 200)
      const snapshot = expectShape(snapshotSchema, reply)
      return `newest_reg_date ${snapshot.newest_reg_date}, stale ${snapshot.stale}`
    },
  },
  {
    name: 'GET /api/radar/clients starts empty for a new user',
    run: async (client, me) => {
      const reply = await client.send('GET', '/api/radar/clients', undefined, me)
      expectStatus(reply, 200)
      const list = expectShape(clientListSchema, reply)
      if (list.company_numbers.length !== 0)
        throw new CheckFailed('a brand new user already has clients')
      return 'empty'
    },
  },
  {
    name: 'PUT /api/radar/clients saves and returns the list, leading zeros kept',
    run: async (client, me) => {
      const reply = await client.send(
        'PUT',
        '/api/radar/clients',
        { company_numbers: SAMPLE_NUMBERS },
        me,
      )
      expectStatus(reply, 200)
      const list = expectShape(clientListSchema, reply)
      if (JSON.stringify(list.company_numbers) !== JSON.stringify(SAMPLE_NUMBERS)) {
        throw new CheckFailed(
          `sent ${JSON.stringify(SAMPLE_NUMBERS)}, got back ${JSON.stringify(list.company_numbers)}`,
        )
      }
      const again = expectShape(
        clientListSchema,
        await client.send('GET', '/api/radar/clients', undefined, me),
      )
      if (again.company_numbers.length !== SAMPLE_NUMBERS.length)
        throw new CheckFailed('the saved list did not persist')
      return `${list.company_numbers.length} numbers saved and read back`
    },
  },
  ...ALL_PRESETS.map((preset): Check => ({
    name: `POST /api/radar/ask runs stored question ${preset.id}`,
    run: async (client, me) => {
      const mode = preset.id.startsWith('clients_') ? 'clients' : 'prospects'
      const reply = await client.send('POST', '/api/radar/ask', { mode, preset: preset.id }, me)
      expectStatus(reply, 200)
      const answer = expectShape(askResponseSchema, reply)
      if (answer.kind !== 'answer')
        throw new CheckFailed(`a stored question must answer, got kind ${answer.kind}`)
      if (answer.row_count < answer.rows.length)
        throw new CheckFailed(
          'row_count is the total match count, so it cannot be below rows.length',
        )
      return `${answer.rows.length} rows of ${answer.row_count}`
    },
  })),
  {
    name: 'POST /api/radar/ask rejects an unknown or inherited preset id',
    run: async (client, me) => {
      for (const preset of ['not_a_preset', 'toString', '__proto__']) {
        const reply = await client.send('POST', '/api/radar/ask', { mode: 'prospects', preset }, me)
        expectStatus(reply, 400)
      }
      return 'all rejected with 400'
    },
  },
  {
    name: 'POST /api/radar/ask refuses a question about turnover',
    optional: true,
    run: async (client, me) => {
      const reply = await client.send(
        'POST',
        '/api/radar/ask',
        { mode: 'prospects', question: "What's Acme's turnover?" },
        me,
      )
      expectStatus(reply, 200)
      const answer = expectShape(askResponseSchema, reply)
      if (answer.kind !== 'refuse')
        throw new CheckFailed(`expected kind refuse, got ${answer.kind}`)
      return 'refused'
    },
  },
  {
    name: 'GET /api/radar/clients hides my list from another user',
    run: async (client) => {
      const stranger = await client.signUp()
      const reply = await client.send('GET', '/api/radar/clients', undefined, stranger)
      expectStatus(reply, 200)
      const list = expectShape(clientListSchema, reply)
      if (list.company_numbers.length > 0)
        throw new CheckFailed(`another user sees ${list.company_numbers.length} of my clients`)
      return 'stranger sees an empty list'
    },
  },
  {
    name: 'GET /api/radar/clients without a session is refused',
    run: async (client) => {
      const reply = await client.send('GET', '/api/radar/clients')
      expectStatus(reply, 401)
      return '401'
    },
  },
]

export async function runContractChecks(client: ContractClient): Promise<CheckResult[]> {
  const me = await client.signUp()
  const results: CheckResult[] = []
  for (const check of CHECKS) {
    try {
      results.push({ name: check.name, outcome: 'pass', detail: await check.run(client, me) })
    } catch (error) {
      if (!(error instanceof CheckFailed)) throw error
      results.push({
        name: check.name,
        outcome: check.optional ? 'warn' : 'fail',
        detail: error.message,
      })
    }
  }
  return results
}

function cookieValue(cookies: string[], name: string): string {
  const pair = cookies
    .map((cookie) => cookie.split(';')[0] ?? '')
    .find((cookie) => cookie.startsWith(`${name}=`))
  return pair?.slice(name.length + 1) ?? ''
}

function httpClient(base: string): ContractClient {
  async function send(
    method: string,
    path: string,
    body?: unknown,
    session?: Session,
  ): Promise<Reply> {
    const headers = new Headers()
    if (session) headers.set('Cookie', session.cookie)
    if (session && method !== 'GET') headers.set('X-CSRF-TOKEN', session.csrf)
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json().catch((): unknown => null) }
  }

  return {
    send,
    signUp: async () => {
      const response = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${randomUUID()}@example.com`, password: randomUUID() }),
      })
      if (!response.ok) throw new Error(`could not create a test user: status ${response.status}`)
      const cookies = response.headers.getSetCookie()
      return {
        cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
        csrf: cookieValue(cookies, 'csrf_access_token'),
      }
    },
  }
}

const MARK = { pass: 'ok  ', fail: 'FAIL', warn: 'warn' } as const

if (import.meta.main) {
  const base = process.argv[2] ?? 'http://127.0.0.1:5001'
  const results = await runContractChecks(httpClient(base))
  for (const result of results)
    console.log(`${MARK[result.outcome]} ${result.name}\n     ${result.detail}`)
  const failed = results.filter((result) => result.outcome === 'fail').length
  console.log(failed === 0 ? '\nThe radar api meets the contract.' : `\n${failed} check(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
}
