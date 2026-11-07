import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signUp } from './session-steps.ts'

async function addNote(page: Page, body: string) {
  await page.getByLabel('New note').fill(body)
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: body })).toBeVisible()
}

async function openNotes(page: Page) {
  await signUp(page)
  await page.goto('/app/notes')
  await expect(page.getByLabel('New note')).toBeVisible()
}

test('a new user sees the empty state', async ({ page }) => {
  await openNotes(page)
  await expect(page.getByText('No notes yet. Add your first one.')).toBeVisible()
})

test('a note persists across a reload and can be deleted', async ({ page }) => {
  await openNotes(page)
  await addNote(page, 'buy cork')
  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'buy cork' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete note: buy cork' }).click()
  await expect(page.getByText('No notes yet. Add your first one.')).toBeVisible()
})

test('note text renders as text, not html', async ({ page }) => {
  await openNotes(page)
  await addNote(page, '<img src=x onerror=alert(1)>')
  await expect(page.locator('li img')).toHaveCount(0)
})

test('another user cannot see my notes', async ({ page, browser }) => {
  await openNotes(page)
  await addNote(page, 'for my eyes only')

  const context = await browser.newContext()
  const strangerPage = await context.newPage()
  await openNotes(strangerPage)
  await expect(strangerPage.getByText('No notes yet. Add your first one.')).toBeVisible()
  await expect(strangerPage.getByText('for my eyes only')).toHaveCount(0)
  await context.close()
})

test('shows a loading state while notes are on the way', async ({ page }) => {
  const { promise: held, resolve: release } = Promise.withResolvers<undefined>()
  await page.route('**/api/notes', async (route) => {
    await held
    await route.continue()
  })
  await openNotes(page)
  await expect(page.getByRole('status')).toHaveText('Loading notes.')
  release(undefined)
  await expect(page.getByText('No notes yet. Add your first one.')).toBeVisible()
})

test('shows an error with a retry when notes fail to load', async ({ page }) => {
  await page.route('**/api/notes', (route) => route.abort())
  await openNotes(page)
  await expect(page.getByRole('alert')).toContainText('Could not reach the server')

  await page.unroute('**/api/notes')
  await page.getByRole('button', { name: 'Load notes again' }).click()
  await expect(page.getByText('No notes yet. Add your first one.')).toBeVisible()
})

test('a lost session returns to sign in', async ({ page, context }) => {
  await openNotes(page)
  await context.clearCookies()
  await page.getByLabel('New note').fill('too late')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
