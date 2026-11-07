import { IconCalendarDue, IconPhoneCall, IconRadar2 } from '@tabler/icons-react'
import { Outlet } from 'react-router'
import { DesktopSidebar, MobileSidebar, Sidebar, SidebarLink } from '#src/components/ui/sidebar'
import type { SidebarItem } from '#src/components/ui/sidebar'

const NAV_ITEMS: readonly SidebarItem[] = [
  { to: '/app', label: 'Today', icon: <IconCalendarDue size={18} aria-hidden />, end: true },
  { to: '/app/radar', label: 'Filing deadlines', icon: <IconRadar2 size={18} aria-hidden /> },
]

function Navigation() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      <span className="mb-8 flex items-center gap-3 px-2.5 font-semibold text-ink">
        <span className="flex size-5 shrink-0 items-center justify-center">
          <IconPhoneCall size={20} aria-hidden />
        </span>
        <span className="whitespace-pre">Dialed In</span>
      </span>
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.to} link={item} />
      ))}
    </nav>
  )
}

export function Shell() {
  return (
    <Sidebar>
      <div className="flex min-h-dvh">
        <DesktopSidebar>
          <Navigation />
        </DesktopSidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-shell px-4 py-2 sm:px-6 lg:hidden">
            <MobileSidebar>
              <Navigation />
            </MobileSidebar>
            <span className="font-semibold text-ink">Dialed In</span>
          </header>
          <main className="flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </Sidebar>
  )
}
