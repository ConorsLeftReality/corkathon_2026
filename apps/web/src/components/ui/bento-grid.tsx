import type { ReactNode } from 'react'
import { cn } from '#src/lib/cn'
import { GlowingEffect } from '#src/components/ui/glowing-effect'

/** aceternity bento grid, restyled to our tokens and with the hover shadow transition removed */
export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:auto-rows-[21rem] md:grid-cols-3', className)}>
      {children}
    </div>
  )
}

type BentoGridItemProps = {
  className?: string
  title: string
  description: string
  header: ReactNode
  icon: ReactNode
}

export function BentoGridItem({ className, title, description, header, icon }: BentoGridItemProps) {
  return (
    <article
      className={cn(
        'group/bento relative flex flex-col justify-between gap-4 rounded-lg border border-line bg-rim p-4 shadow-raised',
        className,
      )}
    >
      <GlowingEffect />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">{header}</div>
      <div className="relative transition-transform duration-200 group-hover/bento:translate-x-1.5">
        <span className="text-signal">{icon}</span>
        <h3 className="mt-2 mb-1 font-semibold text-ink">{title}</h3>
        <p className="text-label text-graphite">{description}</p>
      </div>
    </article>
  )
}
