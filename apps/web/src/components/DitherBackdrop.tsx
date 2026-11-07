import { useEffect, useRef } from 'react'
import { ditherMask, parseRgb } from '#src/lib/dither.ts'

// css pixels per dither cell, big enough to read as a pattern rather than noise
const CELL = 3

export function DitherBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let frame = 0

    function draw(target: HTMLCanvasElement) {
      const width = Math.ceil(window.innerWidth / CELL)
      const height = Math.ceil(window.innerHeight / CELL)
      target.width = width
      target.height = height
      const context = target.getContext('2d')
      // the colour comes from the text-dither token, so the palette stays in theme.css
      const ink = parseRgb(getComputedStyle(target).color)
      if (!context || !ink) return
      const image = context.createImageData(width, height)
      ditherMask(width, height).forEach((inked, index) => {
        if (inked) image.data.set([...ink, 255], index * 4)
      })
      context.putImageData(image, 0, 0)
    }

    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (canvas) draw(canvas)
      })
    }

    draw(canvas)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      data-dither-backdrop
      className="pointer-events-none fixed inset-0 -z-10 size-full text-dither [image-rendering:pixelated]"
    />
  )
}
