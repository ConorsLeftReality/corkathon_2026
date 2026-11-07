import { Link } from 'react-router'
import { assertNever } from '#src/assert-never.ts'
import { Ledger } from '#src/features/radar/Ledger.tsx'
import type { RadarAnswer } from '#src/features/radar/radar-api.ts'
import { useBriefing } from '#src/features/radar/use-today.ts'

function BriefingSection({ title, response }: { title: string; response: RadarAnswer }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="text-graphite">{response.answer}</p>
      <Ledger
        rows={response.rows}
        total={response.row_count}
        caption={`Your clients: ${title.toLowerCase()}`}
      />
    </section>
  )
}

type BriefingPanelProps = { clients: string[]; onSessionLost: () => void }

export function BriefingPanel({ clients, onSessionLost }: BriefingPanelProps) {
  const { state, retry } = useBriefing(clients, onSessionLost)

  switch (state.status) {
    case 'loading':
      return (
        <p role="status" className="text-graphite">
          Checking your clients against the register.
        </p>
      )
    case 'error':
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-danger-deep">
            {state.message}
          </p>
          <button className="button-primary" type="button" onClick={() => void retry()}>
            Check my clients again
          </button>
        </div>
      )
    case 'ready':
      return (
        <div className="flex flex-col gap-6">
          <BriefingSection title="Overdue" response={state.value.overdue} />
          <BriefingSection title="Due in the next 7 days" response={state.value.week} />
          <Link to="/app/radar?mode=clients" className="self-start font-semibold">
            Ask about your clients
          </Link>
        </div>
      )
    default:
      return assertNever(state)
  }
}
