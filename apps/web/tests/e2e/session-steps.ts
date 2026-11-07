import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// sign in is off for the demo, so the app opens straight onto today
export async function openApp(page: Page, path = '/app'): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('main')).toBeVisible()
}
