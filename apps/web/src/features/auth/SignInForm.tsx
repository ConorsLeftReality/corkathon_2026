import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import { register, signIn } from '#src/features/auth/auth-api.ts'
import type { User } from '#src/features/auth/auth-api.ts'

type Mode = 'sign-in' | 'register'

type Props = { onSignedIn: (user: User) => void; invite: string | null }

export function SignInForm({ onSignedIn, invite }: Props) {
  const [mode, setMode] = useState<Mode>(invite ? 'register' : 'sign-in')
  const [askedForAccount, setAskedForAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const emailId = useId()
  const passwordId = useId()
  const hintId = useId()

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      onSignedIn(
        await (mode === 'register' && invite
          ? register({ email, password, invite })
          : signIn({ email, password })),
      )
    } catch (caught) {
      if (!(caught instanceof ApiError)) throw caught
      setError(caught)
      setSubmitting(false)
    }
  }

  const registering = mode === 'register' && invite !== null

  return (
    <form className="flex flex-col gap-4 surface p-6" onSubmit={(event) => void submit(event)}>
      <h2 className="text-h2 font-semibold">{registering ? 'Create account' : 'Sign in'}</h2>
      {registering && (
        <p className="text-graphite">Use the email your invite was sent to. The link works once.</p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          className="field"
          type="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={error?.fields.includes('email') === true}
          onChange={(event) => {
            setEmail(event.target.value)
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={passwordId}>Password</label>
        <input
          id={passwordId}
          className="field"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          required
          value={password}
          aria-invalid={error?.fields.includes('password') === true}
          aria-describedby={registering ? hintId : undefined}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
        {registering && (
          <p id={hintId} className="text-label text-graphite">
            Use at least 8 characters.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-danger-deep">
          {error.message}
        </p>
      )}

      <button className="button-primary" type="submit" disabled={submitting}>
        {registering ? 'Create account' : 'Sign in'}
      </button>
      <button
        className="button-quiet"
        type="button"
        onClick={() => {
          if (invite) setMode(registering ? 'sign-in' : 'register')
          else setAskedForAccount(true)
          setError(null)
        }}
      >
        {registering ? 'I already have an account' : 'I need an account'}
      </button>
      {askedForAccount && !registering && (
        <p role="status" className="text-graphite">
          Accounts are by invite only. Ask your admin for an invite link.
        </p>
      )}
    </form>
  )
}
