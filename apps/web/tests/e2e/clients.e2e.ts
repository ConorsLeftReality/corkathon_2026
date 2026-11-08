import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { uploadClientCsv } from './clients-steps.ts'
import { signUp } from './session-steps.ts'

const EMPTY = 'No clients yet. Add a company number or upload a CSV to fill your Today report.'

async function openClients(page: Page) {
  await signUp(page)
  await page.goto('/app/clients')
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible()
}

function row(page: Page, companyNum: string) {
  return page.getByRole('rowheader', { name: companyNum, exact: true })
}

async function addOne(page: Page, companyNum: string) {
  await page.getByLabel('CRO company number').fill(companyNum)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
}

test('a new account starts with an empty list', async ({ page }) => {
  await openClients(page)
  await expect(page.getByText(EMPTY)).toBeVisible()
})

test('a company added by number shows on today and can be removed', async ({ page }) => {
  await openClients(page)
  await addOne(page, '700001')
  await expect(row(page, '700001')).toBeVisible()

  await page.getByRole('link', { name: 'See their deadlines on Today.' }).click()
  const overdue = page.getByRole('table', { name: 'Your clients: overdue' })
  await expect(overdue.getByRole('rowheader', { name: /E2E OVERDUE LIMITED/ })).toBeVisible()

  await page.goto('/app/clients')
  await page.getByRole('button', { name: 'Remove company 700001' }).click()
  await expect(page.getByText(EMPTY)).toBeVisible()
})

test('adding the same company twice says so', async ({ page }) => {
  await openClients(page)
  await addOne(page, '700001')
  await expect(row(page, '700001')).toBeVisible()
  await addOne(page, '700001')
  await expect(page.getByRole('alert')).toHaveText('That company is already on your list.')
})

test('a csv adds to the list and can replace it', async ({ page }) => {
  await signUp(page)
  await uploadClientCsv(page, 'company_num,name\n700001,a\n700002,b\nnot a number,c\n')
  await expect(page.getByRole('status').filter({ hasText: 'Added 2 companies.' })).toContainText(
    'Skipped 1 row that is not a company number.',
  )
  await expect(row(page, '700002')).toBeVisible()

  await uploadClientCsv(page, '700003\n', 'Replace my whole list')
  await expect(row(page, '700003')).toBeVisible()
  await expect(row(page, '700001')).toHaveCount(0)
})

test('a csv with no company numbers is refused', async ({ page }) => {
  await openClients(page)
  await page.getByLabel('CSV file').setInputFiles({
    name: 'clients.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name\nAcme\n'),
  })
  await page.getByRole('button', { name: 'Upload and add' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'No company numbers found. Put them in a column called company_num.',
  )
  await expect(page.getByText(EMPTY)).toBeVisible()
})

test('another user cannot see my clients', async ({ page, browser }) => {
  await openClients(page)
  await addOne(page, '700002')
  await expect(row(page, '700002')).toBeVisible()

  const other = await browser.newPage()
  await openClients(other)
  await expect(other.getByText(EMPTY)).toBeVisible()
  await other.close()
})

test('the clients screen passes axe and fits the viewport', async ({ page }) => {
  await openClients(page)
  await addOne(page, '700001')
  await expect(row(page, '700001')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('a failed load shows an error and can be retried', async ({ page }) => {
  await signUp(page)
  let calls = 0
  await page.route('**/api/clients', async (route) => {
    calls += 1
    if (calls === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'internal_error', message: 'Something went wrong on the server.' },
        }),
      })
      return
    }
    await route.fallback()
  })
  await page.goto('/app/clients')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on the server.')
  await page.getByRole('button', { name: 'Load clients again' }).click()
  await expect(page.getByText(EMPTY)).toBeVisible()
})
