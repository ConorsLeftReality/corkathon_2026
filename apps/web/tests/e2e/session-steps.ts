import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { invitePath } from './server-env.ts'

export const PASSWORD = 'correct horse battery'

export function uniqueEmail(): string {
  return `${randomUUID()}@example.com`
}

// phones show the email in the top bar, desktops show the avatar in the rail
export function signedInAs(page: Page, email: string) {
  return page
    .getByText(email)
    .or(page.getByRole('img', { name: `Signed in as ${email}` }))
    .filter({ visible: true })
}

// opens a fresh invite link, which lands on the create account form
export async function openInvite(page: Page, email: string): Promise<void> {
  await page.goto(invitePath(email))
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
}

export async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail()
  await openInvite(page, email)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(signedInAs(page, email)).toBeVisible()
  return email
}

export async function openApp(page: Page, path = '/app'): Promise<void> {
  await signUp(page)
  if (path !== '/app') await page.goto(path)
  await expect(page.getByRole('main')).toBeVisible()
}
