import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '#src/lib/cn'

/** aceternity's border magic around its backdrop blur button, the pane stays mostly opaque for contrast */
export function GlassBorderButton({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className="group relative inline-flex overflow-hidden rounded-full p-[1.5px] shadow-glow"
    >
      <span aria-hidden className="glass-edge absolute inset-[-1000%]" />
      <span
        className={cn(
          'relative inline-flex h-full w-full items-center justify-center rounded-full bg-white/80 px-6 font-semibold text-ink backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-90',
          className,
        )}
      >
        {children}
      </span>
    </Link>
  )
}
