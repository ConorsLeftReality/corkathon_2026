import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { signUp } from './session-steps.ts'

// the radar api is not built yet, so these stub it to the contract in docs/02-architecture.md
const snapshot = { fetched_at: '2026-11-07T09:12:00Z', newest_reg_date: '2026-11-06', stale: false }

function row(num: string, name: string, overdue: number, toDeadline: number) {
  return {
    company_num: num,
    company_name: name,
    sector_label: 'Legal and accounting',
    routing_key: 'T12',
    filing_deadline: '2026-11-10',
    days_to_deadline: toDeadline,
    days_overdue: overdue,
    est_penalty_eur: overdue > 0 ? 100 + 3 * overdue : 0,
  }
}

function answer(text: string, rows: ReturnType<typeof row>[]) {
  return {
    kind: 'answer',
    answer: text,
    rows,
    filter: { action: 'query', mode: 'clients' },
    sql: 'SELECT 1',
    params: [],
    row_count: rows.length,
    snapshot,
  }
}

const PRESET_ANSWERS: Record<string, unknown> = {
  clients_overdue: answer('2 of your clients are overdue.', [
    row('700001', 'Placeholder Pharmacy Limited', 12, -12),
    row('700002', 'Placeholder Studios Limited', 3, -3),
  ]),
  clients_this_week: answer('1 of your clients has a deadline in the next 7 days.', [
    row('700003', 'Placeholder Dental Limited', 0, 3),
  ]),
}

type StubOptions = {
  clients?: string[]
  snapshotBody?: unknown
  snapshotStatus?: number
  clientsStatus?: number
  askStatus?: number
  hold?: Promise<unknown>
}

type Stub = { saved: string[][]; asked: unknown[] }

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

const FAILED = { error: { code: 'server_error', message: 'Something went wrong. Try again.' } }

async function stubRadar(page: Page, options: StubOptions = {}): Promise<Stub> {
  let list = options.clients ?? []
  const stub: Stub = { saved: [], asked: [] }

  await page.route('**/api/radar/snapshot', (route) =>
    options.snapshotStatus
      ? json(route, FAILED, options.snapshotStatus)
      : json(route, options.snapshotBody ?? snapshot),
  )
  await page.route('**/api/radar/clients', async (route) => {
    if (options.clientsStatus) return json(route, FAILED, options.clientsStatus)
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { company_numbers: string[] }
      stub.saved.push(body.company_numbers)
      list = body.company_numbers
    }
    return json(route, { company_numbers: list })
  })
  await page.route('**/api/radar/ask', async (route) => {
    const body = route.request().postDataJSON() as { preset: string }
    stub.asked.push(body)
    if (options.hold) await options.hold
    if (options.askStatus) return json(route, FAILED, options.askStatus)
    return json(route, PRESET_ANSWERS[body.preset])
  })
  return stub
}

async function openToday(page: Page) {
  await signUp(page)
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()
}

async function saveNumbers(page: Page, text: string) {
  await page.getByLabel('Company numbers').fill(text)
  await page.getByRole('button', { name: 'Save client list' }).click()
}

test('a new account is asked for its client list', async ({ page }) => {
  const stub = await stubRadar(page)
  await openToday(page)
  await expect(page.getByText('From the CRO register, up to date as of 6 Nov 2026.')).toBeVisible()
  await expect(
    page.getByText("Add your clients' company numbers to see who to chase today."),
  ).toBeVisible()
  await expect(page.getByText('No clients saved yet.')).toBeVisible()
  expect(stub.asked).toEqual([])
})

test('saving a client list shows who is overdue and who is due this week', async ({ page }) => {
  const stub = await stubRadar(page)
  await openToday(page)
  await saveNumbers(page, '700001\n700002, 700003')

  await expect(page.getByText('Client list saved.')).toBeVisible()
  expect(stub.saved).toEqual([['700001', '700002', '700003']])

  const overdue = page.getByRole('table', { name: 'Your clients: overdue' })
  await expect(
    overdue.getByRole('rowheader', { name: /Placeholder Pharmacy Limited/ }),
  ).toBeVisible()
  await expect(overdue.getByText('2 companies matched')).toBeVisible()
  const week = page.getByRole('table', { name: 'Your clients: due in the next 7 days' })
  await expect(week.getByRole('rowheader', { name: /Placeholder Dental Limited/ })).toBeVisible()
  await expect(page.getByText('3 clients saved. Show the numbers.')).toBeVisible()
  expect(stub.asked).toEqual(
    expect.arrayContaining([
      { mode: 'clients', preset: 'clients_overdue' },
      { mode: 'clients', preset: 'clients_this_week' },
    ]),
  )
})

test('entries that are not company numbers are shown and left out', async ({ page }) => {
  const stub = await stubRadar(page)
  await openToday(page)
  await page.getByLabel('Company numbers').fill('company_num\n700001\nAcme')
  await expect(
    page.getByText(
      'Ready to save 1 number. Skipped 2 entries that are not a company number: company_num, Acme.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save client list' }).click()
  await expect(page.getByText('Client list saved.')).toBeVisible()
  expect(stub.saved).toEqual([['700001']])
})

test('a csv file can be chosen instead of pasting', async ({ page }) => {
  const stub = await stubRadar(page)
  await openToday(page)
  await page.getByLabel('Or choose a CSV or text file').setInputFiles({
    name: 'clients.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('company_num,name\n700001,Pharmacy\n700002,Studios\n'),
  })
  await expect(page.getByText('Ready to save 2 numbers.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Save client list' }).click()
  await expect(page.getByText('Client list saved.')).toBeVisible()
  expect(stub.saved).toEqual([['700001', '700002']])
})

test('saving with nothing to save says what is missing', async ({ page }) => {
  const stub = await stubRadar(page)
  await openToday(page)
  await page.getByRole('button', { name: 'Save client list' }).click()
  await expect(page.getByRole('alert')).toHaveText('Add at least one company number.')
  expect(stub.saved).toEqual([])
})

test('a failed save keeps what was typed', async ({ page }) => {
  await stubRadar(page)
  await openToday(page)
  await page.unroute('**/api/radar/clients')
  await page.route('**/api/radar/clients', (route) => json(route, FAILED, 500))
  await saveNumbers(page, '700001')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Try again.')
  await expect(page.getByLabel('Company numbers')).toHaveValue('700001')
})

test('the briefing link opens questions about clients', async ({ page }) => {
  await stubRadar(page, { clients: ['700001'] })
  await openToday(page)
  await page.getByRole('link', { name: 'Ask about your clients' }).click()
  await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'My clients' })).toBeChecked()
})

test('shows a loading state while clients are checked', async ({ page }) => {
  const { promise: held, resolve: release } = Promise.withResolvers<undefined>()
  await stubRadar(page, { clients: ['700001'], hold: held })
  await openToday(page)
  await expect(page.getByText('Checking your clients against the register.')).toBeVisible()
  release(undefined)
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('a failed briefing can be checked again', async ({ page }) => {
  await stubRadar(page, { clients: ['700001'], askStatus: 500 })
  await openToday(page)
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Try again.')

  await page.unroute('**/api/radar/ask')
  await page.route('**/api/radar/ask', (route) => {
    const body = route.request().postDataJSON() as { preset: string }
    return json(route, PRESET_ANSWERS[body.preset])
  })
  await page.getByRole('button', { name: 'Check my clients again' }).click()
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('a client list that fails to load can be loaded again', async ({ page }) => {
  await stubRadar(page, { clientsStatus: 500 })
  await openToday(page)
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Try again.')
  await expect(page.getByText('No clients saved yet.')).toHaveCount(0)

  await page.unroute('**/api/radar/clients')
  await page.route('**/api/radar/clients', (route) => json(route, { company_numbers: [] }))
  await page.getByRole('button', { name: 'Load my client list again' }).click()
  await expect(page.getByText('No clients saved yet.')).toBeVisible()
})

test('stale data carries a warning', async ({ page }) => {
  await stubRadar(page, {
    snapshotBody: { ...snapshot, newest_reg_date: '2025-11-12', stale: true },
  })
  await openToday(page)
  await expect(page.getByRole('note')).toHaveText(
    'This data is from 12 Nov 2025 and may be out of date. Deadlines can have moved since then.',
  )
})

test('a snapshot that cannot be read is reported', async ({ page }) => {
  await stubRadar(page, { snapshotStatus: 500 })
  await openToday(page)
  await expect(page.getByRole('alert')).toContainText(
    'Could not check how recent the register data is.',
  )
})

test('a lost session returns to sign in', async ({ page }) => {
  await stubRadar(page)
  await openToday(page)
  await page.unroute('**/api/radar/clients')
  await page.route('**/api/radar/clients', (route) =>
    json(route, { error: { code: 'unauthorized', message: 'Sign in again.' } }, 401),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('the today screen with a briefing passes axe and fits the viewport', async ({ page }) => {
  await stubRadar(page, { clients: ['700001', '700002', '700003'] })
  await openToday(page)
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()

  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({
    path: `test-results/today-${page.viewportSize()?.width}.png`,
    fullPage: true,
  })
})
