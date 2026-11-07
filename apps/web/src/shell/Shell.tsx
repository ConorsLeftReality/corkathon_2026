import { IconCalendarDue, IconNotes, IconRadar2 } from '@tabler/icons-react'
import { Outlet } from 'react-router'
import { DesktopSidebar, MobileSidebar, Sidebar, SidebarLink } from '#src/components/ui/sidebar'
import type { SidebarItem } from '#src/components/ui/sidebar'
import { useSession } from '#src/features/auth/SessionProvider.tsx'

const NAV_ITEMS: readonly SidebarItem[] = [
  { to: '/app', label: 'Today', icon: <IconCalendarDue size={18} aria-hidden />, end: true },
  { to: '/app/radar', label: 'Filing deadlines', icon: <IconRadar2 size={18} aria-hidden /> },
  { to: '/app/notes', label: 'Notes', icon: <IconNotes size={18} aria-hidden /> },
]

function Navigation() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      <span className="mb-8 flex items-center gap-3 px-2.5 font-semibold text-ink">
        <span className="flex size-5 shrink-0 items-center justify-center">
          <IconRadar2 size={20} aria-hidden />
        </span>
        <span className="whitespace-pre">Filing Radar</span>
      </span>
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.to} link={item} />
      ))}
    </nav>
  )
}

export function Shell() {
  const { state, signOut } = useSession()
  const email = state.status === 'signed-in' ? state.user.email : ''

  return (
    <Sidebar>
      <div className="flex min-h-dvh">
        <DesktopSidebar>
          <Navigation />
        </DesktopSidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-shell px-4 py-2">
            <MobileSidebar>
              <Navigation />
            </MobileSidebar>
            <p className="ml-auto min-w-0 truncate text-label text-graphite">{email}</p>
            <button className="button-quiet" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </header>
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </Sidebar>
  )
}
