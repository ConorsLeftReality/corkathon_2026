import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signUp } from './session-steps.ts'

async function openMenuOnPhones(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
}

test('the landing page leads into the app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open the app' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('the navigation moves between screens without a page load', async ({ page }) => {
  await signUp(page)
  let documentLoads = 0
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentLoads += 1
  })

  await openMenuOnPhones(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Notes' }).click()
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await openMenuOnPhones(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Today' }).click()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  expect(documentLoads).toBe(0)
})

test('the current page is marked in the navigation', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/notes')
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await openMenuOnPhones(page)
  const current = page.getByRole('navigation').getByRole('link', { name: 'Notes' })
  await expect(current).toHaveAttribute('aria-current', 'page')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('the menu takes focus and closes with escape', async ({ page }) => {
    await signUp(page)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test('an unknown address shows the not found page', async ({ page }) => {
  await page.goto('/app/nothing-here')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to the home page' }).click()
  await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible()
})

test('the landing page sign in link opens sign in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('the landing example is labelled as placeholder data', async ({ page }) => {
  await page.goto('/')
  const example = page.getByRole('table', { name: 'Example answer with placeholder companies' })
  await expect(example.getByRole('rowheader', { name: /Placeholder Bakery Limited/ })).toBeVisible()
  await expect(page.getByText('The companies are placeholders, not register data.')).toBeVisible()
})
