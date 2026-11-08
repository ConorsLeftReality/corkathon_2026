import { describe, expect, it } from 'bun:test'
import { uploadSummary } from '#src/features/clients/clients-format.ts'

describe('uploadSummary', () => {
  it('says only what was added when nothing else happened', () => {
    expect(uploadSummary({ added: 1, already_listed: 0, skipped: 0 })).toBe('Added 1 company.')
  })

  it('counts repeats and skipped rows', () => {
    expect(uploadSummary({ added: 3, already_listed: 2, skipped: 1 })).toBe(
      'Added 3 companies. 2 were already on your list. Skipped 1 row that is not a company number.',
    )
  })
})
