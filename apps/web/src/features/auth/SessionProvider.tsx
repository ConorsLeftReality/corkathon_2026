import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import { fetchCurrentUser, signOut as requestSignOut } from '#src/features/auth/auth-api.ts'
import type { User } from '#src/features/auth/auth-api.ts'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User }
  | { status: 'error'; message: string }

type Session = {
  state: SessionState
  retry: () => Promise<void>
  onSignedIn: (user: User) => void
  onSessionLost: () => void
  signOut: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (session === null) throw new Error('useSession needs a SessionProvider above it')
  return session
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const retry = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'signed-in', user: await fetchCurrentUser() })
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) setState({ status: 'signed-out' })
      else setState({ status: 'error', message: error.message })
    }
  }, [])

  useEffect(() => {
    void retry()
  }, [retry])

  const onSignedIn = useCallback((user: User) => {
    setState({ status: 'signed-in', user })
  }, [])

  // stable on purpose, useNotes reloads whenever this identity changes
  const onSessionLost = useCallback(() => {
    setState({ status: 'signed-out' })
  }, [])

  const signOut = useCallback(async () => {
    await requestSignOut()
    setState({ status: 'signed-out' })
  }, [])

  const session = useMemo(
    () => ({ state, retry, onSignedIn, onSessionLost, signOut }),
    [state, retry, onSignedIn, onSessionLost, signOut],
  )

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
