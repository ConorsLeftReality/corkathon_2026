import { describe, expect, it } from 'bun:test'
import { CLIENT_LIST_MAX, parseCompanyNumbers } from '#src/features/radar/client-numbers.ts'

describe('parseCompanyNumbers', () => {
  it('reads numbers split by new lines, commas, semicolons and spaces', () => {
    expect(parseCompanyNumbers('123456\n234567, 345678;456789 567890').numbers).toEqual([
      '123456',
      '234567',
      '345678',
      '456789',
      '567890',
    ])
  })

  it('keeps the first of any repeated number', () => {
    expect(parseCompanyNumbers('123456\n234567\n123456').numbers).toEqual(['123456', '234567'])
  })

  it('reports anything that is not a company number instead of sending it', () => {
    const parsed = parseCompanyNumbers('company_num\n123456\nAcme Ltd')
    expect(parsed.numbers).toEqual(['123456'])
    expect(parsed.skipped).toEqual(['company_num', 'Acme', 'Ltd'])
  })

  it('strips quotes a spreadsheet adds around cells', () => {
    expect(parseCompanyNumbers('"123456","234567"').numbers).toEqual(['123456', '234567'])
  })

  it('returns nothing for blank input', () => {
    expect(parseCompanyNumbers('  \n\t ')).toEqual({ numbers: [], skipped: [], tooMany: false })
  })

  it('flags a list over the limit and keeps only the first entries', () => {
    const text = Array.from({ length: CLIENT_LIST_MAX + 5 }, (_, i) => String(100000 + i)).join(
      '\n',
    )
    const parsed = parseCompanyNumbers(text)
    expect(parsed.tooMany).toBe(true)
    expect(parsed.numbers).toHaveLength(CLIENT_LIST_MAX)
  })
})
