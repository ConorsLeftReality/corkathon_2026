import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconX } from '@tabler/icons-react'
import { AnimatePresence, m } from 'motion/react'
import { cn } from '#src/lib/cn'

/** from aceternity, `label` names the landmark so its text is not loose on the page */
export function StickyBanner({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  const [dismissed, setDismissed] = useState(false)

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <m.div
          key="banner"
          role="region"
          aria-label={label}
          className={cn(
            'sticky inset-x-0 top-0 z-40 flex min-h-12 w-full items-center justify-center py-1 pr-12 pl-4',
            className,
          )}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {children}
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full hover:bg-rim/15"
            onClick={() => {
              setDismissed(true)
            }}
          >
            <IconX size={18} aria-hidden />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  )
}
