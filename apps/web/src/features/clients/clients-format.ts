import type { UploadResult } from '#src/features/clients/clients-api.ts'

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function uploadSummary(result: UploadResult): string {
  const parts = [`Added ${plural(result.added, 'company', 'companies')}.`]
  if (result.already_listed > 0) {
    parts.push(`${plural(result.already_listed, 'was', 'were')} already on your list.`)
  }
  if (result.skipped > 0) {
    parts.push(
      `Skipped ${plural(result.skipped, 'row that is', 'rows that are')} not a company number.`,
    )
  }
  return parts.join(' ')
}
