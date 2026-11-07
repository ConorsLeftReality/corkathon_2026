import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openApp } from './session-steps.ts'

async function openMenuOnPhones(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
}

test('the landing page leads straight into the app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open the app' }).click()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
})

test('the landing header link opens today', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Go to Today' }).click()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
})

test('the navigation moves between screens without a page load', async ({ page }) => {
  await openApp(page)
  let documentLoads = 0
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentLoads += 1
  })

  await openMenuOnPhones(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Filing deadlines' }).click()
  await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await openMenuOnPhones(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Today' }).click()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  expect(documentLoads).toBe(0)
})

test('the current page is marked in the navigation', async ({ page }) => {
  await openApp(page, '/app/radar')
  await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
  await openMenuOnPhones(page)
  const current = page.getByRole('navigation').getByRole('link', { name: 'Filing deadlines' })
  await expect(current).toHaveAttribute('aria-current', 'page')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('the menu takes focus and closes with escape', async ({ page }) => {
    await openApp(page)
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

test('the old sign in address shows the not found page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('the landing example is labelled as placeholder data', async ({ page }) => {
  await page.goto('/')
  const example = page.getByRole('table', { name: 'Example answer with placeholder companies' })
  await expect(example.getByRole('rowheader', { name: /Placeholder Bakery Limited/ })).toBeVisible()
  await expect(page.getByText('The companies are placeholders, not register data.')).toBeVisible()
})

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a cursor resting where the rail appears does not open it over the page', async ({
    page,
  }) => {
    await openApp(page, '/app/radar')
    await expect(page.getByRole('heading', { name: 'Filing deadlines' })).toBeVisible()
    // chrome on linux sends this, with no movement, when the rail renders under a still pointer
    await page.getByRole('navigation', { name: 'Primary' }).dispatchEvent('mouseover')
    await page.getByText('My clients', { exact: true }).click()
    // find prospects sits inside the 232px the open rail would cover
    await page.getByText('Find prospects', { exact: true }).click({ timeout: 3000 })
    await expect(page.getByRole('radio', { name: 'Find prospects' })).toBeChecked()
  })

  test('moving onto the rail opens it and moving away closes it', async ({ page }) => {
    await openApp(page, '/app/radar')
    const label = page.getByRole('navigation').getByText('Filing deadlines', { exact: true })
    await page.mouse.move(400, 300)
    await page.mouse.move(20, 300, { steps: 5 })
    await expect(label).toHaveCSS('opacity', '1')
    await page.mouse.move(700, 300, { steps: 5 })
    await expect(label).toHaveCSS('opacity', '0')
  })
})
