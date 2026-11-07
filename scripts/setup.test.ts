import { describe, expect, it } from 'bun:test'
import { fillSecret } from './setup.ts'

describe('fillSecret', () => {
  it('replaces the placeholder and leaves the rest of the file', () => {
    const filled = fillSecret('# note\nJWT_SECRET_KEY=replace-me\nPORT=1\n', 'abc')
    expect(filled).toBe('# note\nJWT_SECRET_KEY=abc\nPORT=1\n')
  })

  it('throws when the example has no placeholder', () => {
    expect(() => fillSecret('PORT=1\n', 'abc')).toThrow('JWT_SECRET_KEY')
  })
})
