import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function uploadClientCsv(page: Page, csv: string, mode = 'Add to my list') {
  await page.goto('/app/clients')
  await page.getByLabel('CSV file').setInputFiles({
    name: 'clients.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByLabel(mode).check()
  await page.getByRole('button', { name: /Upload and add|Replace my list/ }).click()
  await expect(page.getByText(/^Added \d+ compan/)).toBeVisible()
}
