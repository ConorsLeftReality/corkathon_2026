import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router'
import { IconMenu2, IconX } from '@tabler/icons-react'
import { AnimatePresence, m } from 'motion/react'
import { cn } from '#src/lib/cn'

export type SidebarItem = {
  label: string
  icon: ReactNode
  to: string
  end?: boolean
}

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (context === null) throw new Error('useSidebar needs a Sidebar above it')
  return context
}

export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function DesktopSidebar({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSidebar()

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  // chrome sends mouse events with no movement when the rail renders under a still pointer
  // so only real movement opens it, otherwise it covers the left of the page
  function openOnRealMovement(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || open) return
    if (event.movementX !== 0 || event.movementY !== 0) setOpen(true)
  }

  return (
    // the outer box holds 60px in the flow so the panel widens over the page, not beside it
    <div className="sticky top-0 z-30 hidden h-dvh w-[60px] shrink-0 lg:block">
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-line bg-shell px-2.5 py-5',
          open ? 'w-[232px] shadow-overlay' : 'w-[60px]',
        )}
        onPointerMove={openOnRealMovement}
        onMouseLeave={() => {
          setOpen(false)
        }}
        onFocus={() => {
          setOpen(true)
        }}
        onBlur={closeWhenFocusLeaves}
      >
        {children}
      </div>
    </div>
  )
}

export function MobileSidebar({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSidebar()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, setOpen])

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        className="flex size-9 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-wash"
        onClick={() => {
          setOpen(true)
        }}
      >
        <IconMenu2 size={20} aria-hidden />
      </button>
      {/* portalled because a backdrop-filter on the header would trap a fixed child inside it */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed inset-0 z-[100] flex h-full w-full flex-col bg-shell p-6 pt-5 lg:hidden"
            >
              <button
                ref={closeRef}
                type="button"
                aria-label="Close navigation"
                className="absolute top-4 right-4 flex size-9 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-wash"
                onClick={() => {
                  setOpen(false)
                }}
              >
                <IconX size={20} aria-hidden />
              </button>
              {children}
            </m.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export function SidebarLink({ link }: { link: SidebarItem }) {
  const { open, setOpen } = useSidebar()

  return (
    // the label is transparent while the rail is shut, aria-label keeps the link named
    <NavLink
      to={link.to}
      end={link.end ?? false}
      aria-label={link.label}
      onClick={() => {
        setOpen(false)
      }}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-md px-2.5 py-2 text-body hover:bg-wash',
          isActive
            ? 'font-semibold text-ink before:absolute before:top-2 before:bottom-2 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-signal'
            : 'font-medium text-graphite',
        )
      }
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{link.icon}</span>
      <m.span
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="whitespace-pre"
      >
        {link.label}
      </m.span>
    </NavLink>
  )
}
