import { Link, Navigate, useLocation } from 'react-router'
import { assertNever } from '#src/assert-never.ts'
import { redirectTarget } from '#src/features/auth/redirect-target.ts'
import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { SessionStatus } from '#src/features/auth/SessionStatus.tsx'
import { SignInForm } from '#src/features/auth/SignInForm.tsx'

export function LoginPage() {
  const { state, onSignedIn } = useSession()
  const saved: unknown = useLocation().state

  switch (state.status) {
    case 'loading':
    case 'error':
      return <SessionStatus />
    case 'signed-in':
      return <Navigate to={redirectTarget(saved)} replace />
    case 'signed-out':
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
          <h1 className="text-h1 font-semibold">
            <Link to="/" className="text-ink">
              Dialed In
            </Link>
          </h1>
          <SignInForm onSignedIn={onSignedIn} />
        </main>
      )
    default:
      return assertNever(state)
  }
}
