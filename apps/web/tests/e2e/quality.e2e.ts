import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PASSWORD, signUp, uniqueEmail } from './session-steps.ts'

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test('the sign in screen passes axe and fits the viewport', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expectNoAxeViolations(page)
  await expectNoSidewaysScroll(page)
})

test('the notes screen passes axe and fits the viewport', async ({ page }) => {
  await signUp(page)
  await page.goto('/app/notes')
  await page.getByLabel('New note').fill('x'.repeat(300))
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByRole('listitem')).toBeVisible()
  await expectNoAxeViolations(page)
  await expectNoSidewaysScroll(page)
})

test('an account can be created with the keyboard alone', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/login')
  await page.getByRole('button', { name: 'I need an account' }).focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('Email').focus()
  await page.keyboard.type(email)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')
  await expect(page.getByText(email)).toBeVisible()
})

test('the page runs under the csp with no violations', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible()
  await signUp(page)
  expect(violations).toEqual([])
})

test('the landing page passes axe and fits the viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Open the app' })).toBeVisible()
  await expectNoAxeViolations(page)
  await expectNoSidewaysScroll(page)
})

test('the overview screen passes axe and fits the viewport', async ({ page }) => {
  await signUp(page)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expectNoAxeViolations(page)
  await expectNoSidewaysScroll(page)
})

test('the not found page passes axe', async ({ page }) => {
  await page.goto('/nothing-here')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('fonts load from our own origin', async ({ page }) => {
  const fonts: string[] = []
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') fonts.push(response.url())
  })
  await page.goto('/')
  await expect.poll(() => fonts.length).toBeGreaterThan(0)
  expect(fonts.every((url) => url.startsWith('http://127.0.0.1'))).toBe(true)
})

test('the flipping word changes when motion is allowed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-flip-words]')).not.toHaveText('useful', { timeout: 8000 })
})

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('the flipping word stays on the first word', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    const word = page.locator('[data-flip-words]')
    await expect(word).toHaveText('useful')
    await page.clock.fastForward(10_000)
    await expect(word).toHaveText('useful')
  })
})
