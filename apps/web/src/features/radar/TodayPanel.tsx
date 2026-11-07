import { assertNever } from '#src/assert-never.ts'
import { BriefingPanel } from '#src/features/radar/BriefingPanel.tsx'
import { ClientListPanel } from '#src/features/radar/ClientListPanel.tsx'
import { SnapshotLine } from '#src/features/radar/SnapshotLine.tsx'
import { useClientList, useSnapshot } from '#src/features/radar/use-today.ts'

const TODAY_FORMAT = new Intl.DateTimeFormat('en-IE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function SnapshotStatus({ onSessionLost }: { onSessionLost: () => void }) {
  const state = useSnapshot(onSessionLost)
  switch (state.status) {
    case 'loading':
      return (
        <p role="status" className="text-label text-graphite">
          Checking how recent the register data is.
        </p>
      )
    case 'error':
      return (
        <p role="alert" className="text-label text-danger-deep">
          Could not check how recent the register data is. {state.message}
        </p>
      )
    case 'ready':
      return <SnapshotLine snapshot={state.value} />
    default:
      return assertNever(state)
  }
}

export function TodayPanel({ onSessionLost }: { onSessionLost: () => void }) {
  const clients = useClientList(onSessionLost)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1 font-semibold">Today</h1>
        <p className="text-graphite">{TODAY_FORMAT.format(new Date())}</p>
        <SnapshotStatus onSessionLost={onSessionLost} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="clients-today" className="flex min-w-0 flex-col gap-4">
          <h2 id="clients-today" className="text-h2 font-semibold">
            Your clients today
          </h2>
          {clients.state.status === 'loading' && (
            <p role="status" className="text-graphite">
              Loading your client list.
            </p>
          )}
          {clients.state.status === 'error' && (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-danger-deep">
                {clients.state.message}
              </p>
              <button className="button-primary" type="button" onClick={() => void clients.retry()}>
                Load my client list again
              </button>
            </div>
          )}
          {clients.state.status === 'ready' && clients.state.value.length === 0 && (
            <p className="inset px-4 py-3 text-graphite">
              Add your clients&apos; company numbers to see who to chase today.
            </p>
          )}
          {clients.state.status === 'ready' && clients.state.value.length > 0 && (
            <BriefingPanel clients={clients.state.value} onSessionLost={onSessionLost} />
          )}
        </section>

        <section aria-labelledby="client-list" className="flex flex-col gap-4">
          <h2 id="client-list" className="text-h2 font-semibold">
            Client list
          </h2>
          {clients.state.status === 'ready' ? (
            <ClientListPanel
              saved={clients.state.value}
              saving={clients.saving}
              saveError={clients.saveError}
              onSave={clients.save}
            />
          ) : (
            <p className="text-graphite">Your list appears here once it loads.</p>
          )}
        </section>
      </div>

      <p className="text-micro text-graphite">
        Contains Companies Registration Office data, licensed under CC BY 4.0. Penalties are
        estimates, not legal advice.
      </p>
    </div>
  )
}
