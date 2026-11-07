import { useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { m } from 'motion/react'

/** from aceternity, pointer only so keyboard and touch get the plain child */
export function MagneticButton({
  children,
  strength = 0.4,
  maxDistance = 24,
  className,
}: {
  children: ReactNode
  strength?: number
  maxDistance?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  function follow(event: MouseEvent<HTMLDivElement>) {
    if (ref.current === null) return
    const { width, height, left, top } = ref.current.getBoundingClientRect()
    const x = (event.clientX - (left + width / 2)) * strength
    const y = (event.clientY - (top + height / 2)) * strength
    const scale = Math.min(1, maxDistance / (Math.hypot(x, y) || 1))
    setPosition({ x: x * scale, y: y * scale })
  }

  return (
    <div
      className={className}
      onMouseMove={follow}
      onMouseLeave={() => {
        setPosition({ x: 0, y: 0 })
      }}
    >
      <m.div
        ref={ref}
        animate={position}
        transition={{ type: 'spring', stiffness: 150, damping: 25, mass: 0.1 }}
      >
        {children}
      </m.div>
    </div>
  )
}
