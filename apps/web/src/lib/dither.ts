function bayer(size: number): number[] {
  if (size === 1) return [0]
  const half = size / 2
  const inner = bayer(half)
  const matrix = new Array<number>(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = 4 * (inner[(y % half) * half + (x % half)] ?? 0)
      const quadrant = [0, 2, 3, 1][(y < half ? 0 : 2) + (x < half ? 0 : 1)] ?? 0
      matrix[y * size + x] = base + quadrant
    }
  }
  return matrix
}

export const BAYER_8: readonly number[] = bayer(8)

const RGB = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/

export function parseRgb(color: string): [number, number, number] | null {
  const match = RGB.exec(color.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

// how far the gradient reaches from the bottom right corner, as a share of the diagonal
const REACH = 0.55
// above 1 keeps the tail sparse so most of the page stays clear
const FALLOFF = 2

export function ditherMask(width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height)
  const reach = Math.hypot(width, height) * REACH
  if (reach === 0) return mask
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(width - 1 - x, height - 1 - y)
      const density = Math.max(0, 1 - distance / reach) ** FALLOFF
      const threshold = ((BAYER_8[(y % 8) * 8 + (x % 8)] ?? 0) + 0.5) / 64
      mask[y * width + x] = density > threshold ? 1 : 0
    }
  }
  return mask
}
