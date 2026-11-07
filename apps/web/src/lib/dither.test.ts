import { describe, expect, it } from 'bun:test'
import { BAYER_8, ditherMask, parseRgb } from '#src/lib/dither.ts'

describe('parseRgb', () => {
  it('reads the comma form getComputedStyle returns', () => {
    expect(parseRgb('rgb(195, 205, 227)')).toEqual([195, 205, 227])
  })

  it('reads the space separated form', () => {
    expect(parseRgb('rgb(195 205 227)')).toEqual([195, 205, 227])
  })

  it('gives up on anything else so nothing is drawn', () => {
    expect(parseRgb('color(display-p3 1 0 0)')).toBeNull()
  })
})

describe('BAYER_8', () => {
  it('holds every threshold from 0 to 63 exactly once', () => {
    expect([...BAYER_8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i))
  })
})

describe('ditherMask', () => {
  it('inks the corner the gradient starts from', () => {
    const mask = ditherMask(100, 60)
    expect(mask[59 * 100 + 99]).toBe(1)
  })

  it('leaves the far corner clear for content', () => {
    const mask = ditherMask(100, 60)
    expect(mask[0]).toBe(0)
  })

  it('thins out with distance from the corner', () => {
    const width = 200
    const height = 120
    const mask = ditherMask(width, height)
    const density = (x0: number, y0: number) => {
      let inked = 0
      for (let y = y0; y < y0 + 16; y += 1) {
        for (let x = x0; x < x0 + 16; x += 1) inked += mask[y * width + x] ?? 0
      }
      return inked / 256
    }
    expect(density(184, 104)).toBeGreaterThan(density(120, 60))
    expect(density(120, 60)).toBeGreaterThan(density(40, 20))
  })

  it('returns one cell per pixel of the grid', () => {
    expect(ditherMask(7, 3)).toHaveLength(21)
  })

  it('handles an empty grid', () => {
    expect(ditherMask(0, 0)).toHaveLength(0)
  })
})
