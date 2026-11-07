import { Navigate, Outlet, useLocation } from 'react-router'
import { assertNever } from '#src/assert-never.ts'
import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { SessionStatus } from '#src/features/auth/SessionStatus.tsx'

export function RequireSession() {
  const { state } = useSession()
  const { pathname, search } = useLocation()

  switch (state.status) {
    case 'loading':
    case 'error':
      return <SessionStatus />
    case 'signed-out':
      return <Navigate to="/login" replace state={{ from: pathname + search }} />
    case 'signed-in':
      return <Outlet />
    default:
      return assertNever(state)
  }
}
