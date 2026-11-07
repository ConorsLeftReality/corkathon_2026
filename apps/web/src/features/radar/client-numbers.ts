// matches PUT /api/radar/clients in docs/02-architecture.md
export const CLIENT_LIST_MAX = 2000

const COMPANY_NUMBER = /^\d{1,8}$/
const SEPARATORS = /[\s,;]+/

export type ParsedNumbers = { numbers: string[]; skipped: string[]; tooMany: boolean }

export function parseCompanyNumbers(text: string): ParsedNumbers {
  const numbers = new Set<string>()
  const skipped: string[] = []
  for (const raw of text.split(SEPARATORS)) {
    const token = raw.replace(/^["']+|["']+$/g, '')
    if (token === '') continue
    if (COMPANY_NUMBER.test(token)) numbers.add(token)
    else skipped.push(token)
  }
  const unique = [...numbers]
  return {
    numbers: unique.slice(0, CLIENT_LIST_MAX),
    skipped,
    tooMany: unique.length > CLIENT_LIST_MAX,
  }
}
