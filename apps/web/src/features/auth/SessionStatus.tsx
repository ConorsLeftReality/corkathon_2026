import { useSession } from '#src/features/auth/SessionProvider.tsx'

export function SessionStatus() {
  const { state, retry } = useSession()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      {state.status === 'error' ? (
        <>
          <h1 className="text-h2 font-semibold">Could not check your session</h1>
          <p role="alert" className="text-danger-deep">
            {state.message}
          </p>
          <button className="button-primary self-start" type="button" onClick={() => void retry()}>
            Try again
          </button>
        </>
      ) : (
        <p role="status">Checking your session.</p>
      )}
    </main>
  )
}
