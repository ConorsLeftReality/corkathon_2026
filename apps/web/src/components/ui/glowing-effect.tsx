import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { cn } from '#src/lib/cn'

type GlowingEffectProps = {
  spread?: number
  proximity?: number
  inactiveZone?: number
  borderWidth?: number
  className?: string
}

// our blues in place of the registry's pink, gold and green
const GRADIENT = `repeating-conic-gradient(
  from 236.84deg at 50% 50%,
  var(--color-signal) 0%,
  var(--color-edge-cool) 10%,
  var(--color-edge-soft) 20%,
  var(--color-signal) 25%
)`

/**
 * aceternity glowing effect, a border glow that points at the cursor
 * snaps to the pointer instead of tweening a css variable, and stays off for touch and reduced motion
 */
export function GlowingEffect({
  spread = 24,
  proximity = 48,
  inactiveZone = 0.6,
  borderWidth = 1.5,
  className,
}: GlowingEffectProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!element || !finePointer || reduced) return
    let frame = 0

    function follow(event: PointerEvent) {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!element) return
        const { left, top, width, height } = element.getBoundingClientRect()
        const centerX = left + width / 2
        const centerY = top + height / 2
        const inactive = (Math.min(width, height) / 2) * inactiveZone
        const near =
          event.clientX > left - proximity &&
          event.clientX < left + width + proximity &&
          event.clientY > top - proximity &&
          event.clientY < top + height + proximity
        const active =
          near && Math.hypot(event.clientX - centerX, event.clientY - centerY) > inactive
        element.style.setProperty('--active', active ? '1' : '0')
        if (!active) return
        const angle =
          (180 * Math.atan2(event.clientY - centerY, event.clientX - centerX)) / Math.PI + 90
        element.style.setProperty('--start', String(angle))
      })
    }

    document.body.addEventListener('pointermove', follow, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      document.body.removeEventListener('pointermove', follow)
    }
  }, [proximity, inactiveZone])

  return (
    <div
      ref={ref}
      aria-hidden
      style={
        {
          '--spread': spread,
          '--start': '0',
          '--active': '0',
          '--glow-border': `${borderWidth}px`,
          '--gradient': GRADIENT,
        } as CSSProperties
      }
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
    >
      <div
        className={cn(
          'rounded-[inherit]',
          "after:absolute after:inset-[calc(-1*var(--glow-border))] after:rounded-[inherit] after:content-['']",
          'after:[border:var(--glow-border)_solid_transparent]',
          'after:[background:var(--gradient)] after:[background-attachment:fixed]',
          'after:opacity-(--active) after:transition-opacity after:duration-300',
          'after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect]',
          'after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]',
        )}
      />
    </div>
  )
}
