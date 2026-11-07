import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { openApp, signUp } from './session-steps.ts'

// the radar api is not built yet, so these stub it to the contract in docs/02-architecture.md
const ASK = '**/api/radar/ask'

const snapshot = { fetched_at: '2026-11-07T09:12:00Z', newest_reg_date: '2026-11-06', stale: false }

const rows = [
  {
    company_num: '600001',
    company_name: 'Placeholder Bakery Limited',
    sector_label: 'Food and beverage service',
    routing_key: 'T12',
    filing_deadline: '2026-06-20',
    days_to_deadline: -140,
    days_overdue: 140,
    est_penalty_eur: 520,
  },
  {
    company_num: '600002',
    company_name: 'Placeholder Harbour Hotel Designated Activity Company With A Long Name',
    sector_label: null,
    routing_key: null,
    filing_deadline: '2026-08-03',
    days_to_deadline: -96,
    days_overdue: 96,
    est_penalty_eur: 388,
  },
]

const answer = {
  kind: 'answer',
  answer: '12 Cork hospitality companies are overdue.',
  rows,
  filter: { action: 'query', mode: 'prospects', overdue_only: true, area: 'cork_county' },
  sql: 'SELECT company_num FROM f WHERE overdue AND routing_key IN (?, ?) LIMIT ?',
  params: ['T12', 'T23', 10],
  row_count: 12,
  snapshot,
}

function reply(body: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function openRadar(page: Page) {
  await signUp(page)
  await page.goto('/app/radar')
  await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
}

async function askQuestion(page: Page, question: string) {
  await page.getByLabel('Your question').fill(question)
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
}

test('a new visitor sees example questions before asking anything', async ({ page }) => {
  await openRadar(page)
  await expect(page.getByText('Ask in your own words, or start with one of these.')).toBeVisible()
  const examples = page.getByRole('list', { name: 'Example questions' })
  await expect(examples.getByRole('button')).toHaveCount(2)
})

test('a question shows the answer, the ranked companies and the total', async ({ page }) => {
  let sent: unknown
  await page.route(ASK, async (route) => {
    sent = route.request().postDataJSON()
    await reply(answer)(route)
  })
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')

  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
  const table = page.getByRole('table', { name: 'Companies that match, most urgent first' })
  await expect(table.getByRole('rowheader', { name: /Placeholder Bakery Limited/ })).toBeVisible()
  await expect(table.getByText('140', { exact: true })).toBeVisible()
  await expect(table.getByText('12 companies matched, showing the first 2')).toBeVisible()
  await expect(page.getByText('From the CRO register, up to date as of 6 Nov 2026.')).toBeVisible()
  expect(sent).toEqual({ mode: 'prospects', question: 'overdue cork hospitality' })
})

test('the working paper shows the filter and query that produced the answer', async ({ page }) => {
  await page.route(ASK, reply(answer))
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')

  await page.getByText('How this was worked out').click()
  await expect(page.getByRole('heading', { name: 'The filter the AI chose' })).toBeVisible()
  await expect(page.getByText('"overdue_only": true')).toBeVisible()
  await expect(page.getByText(answer.sql)).toBeVisible()
  await expect(
    page.getByText('12 rows matched in the CRO Company Records snapshot.', { exact: false }),
  ).toBeVisible()
})

test('an example question runs its stored filter by id', async ({ page }) => {
  let sent: unknown
  await page.route(ASK, async (route) => {
    sent = route.request().postDataJSON()
    await reply(answer)(route)
  })
  await openRadar(page)
  await page
    .getByRole('button', {
      name: 'Which Cork hospitality companies are overdue on their annual return?',
    })
    .click()
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
  expect(sent).toEqual({ mode: 'prospects', preset: 'overdue_cork_hospitality' })

  await page.getByText('How this was worked out').click()
  await expect(page.getByText('No AI was used.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The stored filter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The filter the AI chose' })).toHaveCount(0)
})

test('switching to my clients searches the client list', async ({ page }) => {
  let sent: unknown
  await page.route(ASK, async (route) => {
    sent = route.request().postDataJSON()
    await reply(answer)(route)
  })
  await openRadar(page)
  await page.getByText('My clients', { exact: true }).click()
  await expect(page.getByText('Search only your client list')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Who do I need to chase this week?' }),
  ).toBeVisible()
  await askQuestion(page, 'who is due')
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
  expect(sent).toEqual({ mode: 'clients', question: 'who is due' })
})

test('shows a loading state while the register is checked', async ({ page }) => {
  const { promise: held, resolve: release } = Promise.withResolvers<undefined>()
  await page.route(ASK, async (route) => {
    await held
    await reply(answer)(route)
  })
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByRole('status')).toHaveText('Checking the register.')
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled()
  release(undefined)
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
})

test('no matches shows the answer and the filter but no table', async ({ page }) => {
  await page.route(
    ASK,
    reply({
      ...answer,
      answer: 'No companies match. The filter that ran is below.',
      rows: [],
      row_count: 0,
    }),
  )
  await openRadar(page)
  await askQuestion(page, 'overdue cork zoos')
  await expect(page.getByText('No companies match. The filter that ran is below.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByText('How this was worked out')).toBeVisible()
})

test('a clarifying question is shown instead of a table', async ({ page }) => {
  await page.route(
    ASK,
    reply({
      kind: 'clarify',
      message: 'Which area should I look in? For example Cork city or County Cork.',
      snapshot,
    }),
  )
  await openRadar(page)
  await askQuestion(page, 'which companies are due soon')
  await expect(page.getByText('Which area should I look in?', { exact: false })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('stale data carries a warning', async ({ page }) => {
  await page.route(
    ASK,
    reply({ ...answer, snapshot: { ...snapshot, newest_reg_date: '2025-11-12', stale: true } }),
  )
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByRole('note')).toHaveText(
    'This data is from 12 Nov 2025 and may be out of date. Deadlines can have moved since then.',
  )
})

test('when the ai is down the stored questions are offered', async ({ page }) => {
  await page.route(
    ASK,
    reply(
      {
        error: {
          code: 'radar_llm_unavailable',
          message: 'Questions are unavailable right now. Try again in a minute.',
        },
      },
      503,
    ),
  )
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByRole('alert')).toHaveText(
    'Questions are unavailable right now. Try again in a minute.',
  )
  await expect(
    page.getByText('These questions still work, because they skip the AI.'),
  ).toBeVisible()

  await page.unroute(ASK)
  await page.route(ASK, reply(answer))
  await page.getByRole('button', { name: 'Which Cork city companies are most overdue?' }).click()
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
})

test('a network failure says what happened', async ({ page }) => {
  await page.route(ASK, (route) => route.abort())
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByRole('alert')).toContainText('Could not reach the server')
})

test('company names render as text, not html', async ({ page }) => {
  await page.route(
    ASK,
    reply({ ...answer, rows: [{ ...rows[0], company_name: '<img src=x onerror=alert(1)>' }] }),
  )
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible()
  await expect(page.locator('table img')).toHaveCount(0)
})

test('a lost session returns to sign in', async ({ page }) => {
  await page.route(ASK, reply({ error: { code: 'unauthorized', message: 'Sign in again.' } }, 401))
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('the whole flow works from the keyboard', async ({ page }) => {
  await page.route(ASK, reply(answer))
  await openRadar(page)
  await page.getByRole('radio', { name: 'Find prospects' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'My clients' })).toBeChecked()
  await page.getByLabel('Your question').focus()
  await page.keyboard.type('who is due')
  await page.keyboard.press('Enter')
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
})

test('the answer screen passes axe and fits the viewport', async ({ page }) => {
  await page.route(ASK, reply(answer))
  await openRadar(page)
  await askQuestion(page, 'overdue cork hospitality')
  await expect(page.getByText('12 Cork hospitality companies are overdue.')).toBeVisible()
  await page.getByText('How this was worked out').click()

  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({
    path: `test-results/radar-${page.viewportSize()?.width}.png`,
    fullPage: true,
  })
})

// no stubs: the built app, the real flask radar route and the fixture snapshot from playwright.config.ts
test('an example question reads the real register behind sign in', async ({ page }) => {
  await openApp(page, '/app/radar')
  await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
  const question = 'Which Cork hospitality companies are overdue on their annual return?'
  const table = page.getByRole('table', { name: 'Companies that match, most urgent first' })
  // the first ask of the day prepares in the background, so ask again until it lands
  await expect(async () => {
    await page.getByRole('button', { name: question }).first().click()
    await expect(table.getByRole('rowheader', { name: /E2E HARBOUR CAFE LIMITED/ })).toBeVisible({
      timeout: 2000,
    })
  }).toPass({ timeout: 20_000 })
  await page.getByText('How this was worked out').click()
  await expect(page.getByText('No AI was used.', { exact: false })).toBeVisible()
  await expect(page.getByText('starts 55 or 56', { exact: false })).toBeVisible()
})
