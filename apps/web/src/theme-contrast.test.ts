import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(import.meta.dir, 'theme.css'), 'utf8')

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(css)
  if (!match?.[1]) throw new Error(`no hex token --color-${name}`)
  return match[1]
}

function linear(hex: string, start: number): number {
  const c = parseInt(hex.slice(start, start + 2), 16) / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  return 0.2126 * linear(hex, 1) + 0.7152 * linear(hex, 3) + 0.0722 * linear(hex, 5)
}

function contrast(foreground: string, background: string): number {
  const a = luminance(token(foreground))
  const b = luminance(token(background))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const TEXT_PAIRS: [string, string][] = [
  ['ink', 'shell'],
  ['graphite', 'shell'],
  ['ink', 'rim'],
  ['graphite', 'rim'],
  ['signal', 'rim'],
  ['signal', 'shell'],
  ['rim', 'signal'],
  ['signal-deep', 'signal-tint'],
  ['danger-deep', 'rim'],
  ['danger-deep', 'danger-tint'],
  ['warning-deep', 'rim'],
  ['warning-deep', 'warning-tint'],
  ['success-deep', 'rim'],
]

describe('theme contrast', () => {
  for (const [foreground, background] of TEXT_PAIRS) {
    it(`${foreground} text on ${background} clears 4.5:1`, () => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('field borders clear 3:1 against the surface', () => {
    expect(contrast('haze', 'rim')).toBeGreaterThanOrEqual(3)
  })

  it('the ledger rule stays quiet behind text', () => {
    expect(contrast('rule', 'rim')).toBeLessThan(3)
  })
})
