import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PASSWORD, signUp, uniqueEmail, signedInAs } from './session-steps.ts'

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
  await expect(signedInAs(page, email)).toBeVisible()
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
  await page.screenshot({
    path: `test-results/landing-${page.viewportSize()?.width}.png`,
    fullPage: true,
  })
})

test('the today screen passes axe and fits the viewport', async ({ page }) => {
  await signUp(page)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
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

test('the dither backdrop draws in the corner and stays out of assistive tech', async ({
  page,
}) => {
  await page.goto('/')
  const backdrop = page.locator('[data-dither-backdrop]')
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true')
  const inked = await backdrop.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) return null
    const alphaAt = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3]
    return {
      corner: alphaAt(canvas.width - 1, canvas.height - 1),
      origin: alphaAt(0, 0),
    }
  })
  expect(inked).toEqual({ corner: 255, origin: 0 })
})
