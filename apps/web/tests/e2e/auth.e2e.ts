import { expect, test } from '@playwright/test'
import { PASSWORD, signUp, uniqueEmail, signedInAs } from './session-steps.ts'

test('a new user can create an account, sign out and sign back in', async ({ page }) => {
  const email = await signUp(page)
  await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(signedInAs(page, email)).toBeVisible()
})

test('a session survives a reload', async ({ page }) => {
  const email = await signUp(page)
  await page.reload()
  await expect(signedInAs(page, email)).toBeVisible()
})

test('a wrong password shows an error and stays signed out', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('wrong password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
})

test('a short password marks the field invalid', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'I need an account' }).click()
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toBeVisible()
})

test('the session cookie is hidden from page scripts', async ({ page }) => {
  await signUp(page)
  const visibleCookies = await page.evaluate(() => document.cookie)
  expect(visibleCookies).toContain('csrf_access_token')
  expect(visibleCookies).not.toContain('access_token_cookie')
})

test('shows an error with a retry when the api is down at startup', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.abort())
  await page.goto('/login')
  await expect(page.getByRole('alert')).toContainText('Could not reach the server')

  await page.unroute('**/api/auth/me')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('a signed out visitor returns to the page they asked for after signing in', async ({
  page,
}) => {
  const email = await signUp(page)
  await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.goto('/app/notes')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/notes$/)
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
})

test('a signed in user skips the login page', async ({ page }) => {
  await signUp(page)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/app$/)
})
