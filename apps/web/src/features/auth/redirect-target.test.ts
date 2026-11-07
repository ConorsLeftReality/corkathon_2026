import { describe, expect, it } from 'bun:test'
import { redirectTarget } from '#src/features/auth/redirect-target.ts'

describe('redirectTarget', () => {
  it('returns to the page the user asked for', () => {
    expect(redirectTarget({ from: '/app/notes?tab=1' })).toBe('/app/notes?tab=1')
  })

  it('falls back to the app with no saved page', () => {
    expect(redirectTarget(null)).toBe('/app')
    expect(redirectTarget({ from: 42 })).toBe('/app')
  })

  it('refuses anything that would leave the site', () => {
    for (const from of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
      expect(redirectTarget({ from })).toBe('/app')
    }
  })
})
