import { describe, expect, it } from 'bun:test'
import { cn } from '#src/lib/cn'

describe('cn', () => {
  it('keeps a text colour and a text size token together', () => {
    expect(cn('text-rim', 'text-body')).toBe('text-rim text-body')
  })

  it('keeps a shadow token beside a shadow colour', () => {
    expect(cn('shadow-ink', 'shadow-raised')).toBe('shadow-ink shadow-raised')
  })

  it('lets a later utility win over an earlier one in the same group', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-h1', 'text-h2')).toBe('text-h2')
  })
})
