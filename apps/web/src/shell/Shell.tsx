import {
  IconCalendarDue,
  IconLogout,
  IconNotes,
  IconPhoneCall,
  IconRadar2,
} from '@tabler/icons-react'
import { Outlet } from 'react-router'
import {
  DesktopSidebar,
  MobileSidebar,
  Sidebar,
  SidebarAction,
  SidebarLabel,
  SidebarLink,
} from '#src/components/ui/sidebar'
import type { SidebarItem } from '#src/components/ui/sidebar'
import { useSession } from '#src/features/auth/SessionProvider.tsx'

const NAV_ITEMS: readonly SidebarItem[] = [
  { to: '/app', label: 'Today', icon: <IconCalendarDue size={18} aria-hidden />, end: true },
  { to: '/app/radar', label: 'Filing deadlines', icon: <IconRadar2 size={18} aria-hidden /> },
  { to: '/app/notes', label: 'Notes', icon: <IconNotes size={18} aria-hidden /> },
]

function Brand() {
  return (
    <span className="mb-8 flex items-center gap-3 px-2.5 py-1 font-semibold text-ink">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-signal text-rim">
        <IconPhoneCall size={14} aria-hidden />
      </span>
      <SidebarLabel>Dialed-In</SidebarLabel>
    </span>
  )
}

function Navigation() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      <Brand />
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.to} link={item} />
      ))}
    </nav>
  )
}

function Account({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <section aria-label="Your account" className="flex flex-col gap-0.5 border-t border-line pt-3">
      <div className="flex items-center gap-3 px-1.5 py-1.5">
        <span
          role="img"
          aria-label={`Signed in as ${email}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal-tint text-label font-semibold text-signal-deep uppercase"
        >
          {email.slice(0, 1)}
        </span>
        <SidebarLabel className="min-w-0 truncate text-label text-graphite">{email}</SidebarLabel>
      </div>
      <SidebarAction
        label="Sign out"
        icon={<IconLogout size={18} aria-hidden />}
        onClick={onSignOut}
      />
    </section>
  )
}

export function Shell() {
  const { state, signOut } = useSession()
  const email = state.status === 'signed-in' ? state.user.email : ''
  const leave = () => void signOut()

  return (
    <Sidebar>
      <div className="flex min-h-dvh">
        <DesktopSidebar>
          <div className="flex min-h-0 flex-1 flex-col">
            <Navigation />
          </div>
          <Account email={email} onSignOut={leave} />
        </DesktopSidebar>
        <div className="flex min-w-0 flex-1 flex-col lg:pt-2">
          {/* phones keep a top bar, the desktop rail carries the account instead */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-shell px-4 py-2 sm:px-6 lg:hidden">
            <MobileSidebar>
              <Navigation />
            </MobileSidebar>
            <p className="ml-auto min-w-0 truncate text-label text-graphite">{email}</p>
            <button className="button-quiet" type="button" onClick={leave}>
              Sign out
            </button>
          </header>
          <main className="flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:rounded-tl-xl lg:border-t lg:border-l lg:border-line lg:bg-rim lg:px-8 lg:shadow-raised">
            <Outlet />
          </main>
        </div>
      </div>
    </Sidebar>
  )
}
