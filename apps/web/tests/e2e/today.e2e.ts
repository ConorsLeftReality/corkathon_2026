import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { openApp } from './session-steps.ts'

// stubs matteo/app.py, the filings api, in the shape its report.json takes

function company(num: string, name: string, status: string, daysLeft: number | null) {
  return {
    company_num: num,
    company_name: name,
    company_status: name === '' ? '' : 'Normal',
    company_type: 'LTD - Private Company Limited by Shares',
    address: name === '' ? '' : '1 Placeholder Street, Cork',
    last_ar_date: daysLeft === null ? null : '2025-09-01',
    nard: daysLeft === null ? null : '2026-09-15',
    deadline: daysLeft === null ? null : '2026-11-10',
    days_left: daysLeft,
    status,
  }
}

const report = {
  generated_at: '2026-11-07T09:12:00',
  as_of: '2026-11-07',
  window_days: 30,
  grace_days: 56,
  counts: { overdue: 2, due: 1, ok: 1, unknown: 0, dissolved: 0, not_found: 1 },
  companies: [
    company('700001', 'Placeholder Pharmacy Limited', 'overdue', -12),
    company('700002', 'Placeholder Studios Limited', 'overdue', -3),
    company('700003', 'Placeholder Dental Limited', 'due', 3),
    company('700006', 'Placeholder Bakery Limited', 'ok', 130),
    company('700099', '', 'not_found', null),
  ],
  source: 'Contains data from the Companies Registration Office (CRO), licensed under CC BY 4.0.',
}

const BRIEFING =
  'Filing briefing for 7 November 2026.\n\nOverdue companies\n2 companies are overdue.'

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

type Stub = { refreshes: number }

async function stubFilings(
  page: Page,
  options: { reportBody?: unknown; reportStatus?: number; hold?: Promise<unknown> } = {},
): Promise<Stub> {
  const stub: Stub = { refreshes: 0 }
  await page.route('**/api/report', async (route) => {
    if (options.hold) await options.hold
    await json(route, options.reportBody ?? report, options.reportStatus ?? 200)
  })
  await page.route('**/api/briefing', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: BRIEFING }),
  )
  await page.route('**/api/refresh', async (route) => {
    stub.refreshes += 1
    await json(route, report)
  })
  return stub
}

async function openToday(page: Page) {
  await openApp(page)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
}

test('the report shows counts, overdue and due clients', async ({ page }) => {
  await stubFilings(page)
  await openToday(page)

  const tiles = page.getByRole('list', { name: 'Clients by filing status' })
  await expect(tiles.getByRole('listitem').filter({ hasText: 'Overdue' })).toContainText('2')
  await expect(
    tiles.getByRole('listitem').filter({ hasText: 'Due in the next 30 days' }),
  ).toContainText('1')
  await expect(
    tiles.getByRole('listitem').filter({ hasText: 'Not found or no date' }),
  ).toContainText('1')

  const overdue = page.getByRole('table', { name: 'Your clients: overdue' })
  await expect(
    overdue.getByRole('rowheader', { name: /Placeholder Pharmacy Limited/ }),
  ).toBeVisible()
  await expect(overdue.getByText('12', { exact: true })).toBeVisible()
  const due = page.getByRole('table', { name: 'Your clients: due in the next 30 days' })
  await expect(due.getByRole('rowheader', { name: /Placeholder Dental Limited/ })).toBeVisible()
  await expect(page.getByText('Report for 7 Nov 2026', { exact: false })).toBeVisible()
})

test('the briefing the phone reads is shown and can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await stubFilings(page)
  await openToday(page)
  await expect(page.getByText('Filing briefing for 7 November 2026.')).toBeVisible()
  await page.getByRole('button', { name: 'Copy briefing' }).click()
  await expect(page.getByText('Briefing copied')).toBeVisible()
  // the os clipboard rewrites line endings, so compare the words
  const words = (text: string) => text.replace(/\s+/g, ' ').trim()
  expect(words(await page.evaluate(() => navigator.clipboard.readText()))).toBe(words(BRIEFING))
})

test('rebuild asks the filings api for a fresh report', async ({ page }) => {
  const stub = await stubFilings(page)
  await openToday(page)
  await page.getByRole('button', { name: 'Rebuild report' }).click()
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
  expect(stub.refreshes).toBe(1)
})

test('a failed rebuild says why and keeps the old report', async ({ page }) => {
  await stubFilings(page)
  await openToday(page)
  await page.unroute('**/api/refresh')
  await page.route('**/api/refresh', (route) =>
    json(route, { error: 'Company list not found: my_companies.csv' }, 500),
  )
  await page.getByRole('button', { name: 'Rebuild report' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Could not rebuild the report. Company list not found: my_companies.csv',
  )
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('shows a loading state while the report is built', async ({ page }) => {
  const { promise: held, resolve: release } = Promise.withResolvers<undefined>()
  await stubFilings(page, { hold: held })
  await openToday(page)
  await expect(page.getByText("Loading today's filing report.")).toBeVisible()
  release(undefined)
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('an error from the filings api is shown and can be retried', async ({ page }) => {
  await stubFilings(page, {
    reportBody: { error: 'Company list not found: my_companies.csv' },
    reportStatus: 500,
  })
  await openToday(page)
  await expect(page.getByRole('alert')).toHaveText('Company list not found: my_companies.csv')

  await page.unroute('**/api/report')
  await page.route('**/api/report', (route) => json(route, report))
  await page.getByRole('button', { name: 'Load the report again' }).click()
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('says so when the filings api is not running', async ({ page }) => {
  await stubFilings(page)
  await page.unroute('**/api/report')
  await page.route('**/api/report', (route) => route.abort())
  await openToday(page)
  await expect(page.getByRole('alert')).toHaveText(
    'Could not reach the filings service. Check that it is running and try again.',
  )
})

test('a briefing that fails to load does not hide the report', async ({ page }) => {
  await stubFilings(page)
  await page.unroute('**/api/briefing')
  await page.route('**/api/briefing', (route) =>
    json(route, { error: 'briefing.txt missing' }, 500),
  )
  await openToday(page)
  await expect(page.getByText('Could not load the briefing. briefing.txt missing')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
})

test('an empty report says how to add clients', async ({ page }) => {
  await stubFilings(page, {
    reportBody: { ...report, companies: [], counts: { overdue: 0, due: 0, ok: 0 } },
  })
  await openToday(page)
  await expect(page.getByText('No clients in the report yet.', { exact: false })).toBeVisible()
})

test('company names render as text, not html', async ({ page }) => {
  await stubFilings(page, {
    reportBody: {
      ...report,
      companies: [company('700001', '<img src=x onerror=alert(1)>', 'overdue', -12)],
    },
  })
  await openToday(page)
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible()
  await expect(page.locator('table img')).toHaveCount(0)
})

test('the today screen passes axe and fits the viewport', async ({ page }) => {
  await stubFilings(page)
  await openToday(page)
  await expect(page.getByRole('table', { name: 'Your clients: overdue' })).toBeVisible()
  await expect(page.getByText('Filing briefing for 7 November 2026.')).toBeVisible()

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
