import { IconPhoneCall } from '@tabler/icons-react'
import { Link } from 'react-router'
import { Ledger } from '#src/features/radar/Ledger.tsx'
import type { RadarRow } from '#src/features/radar/radar-api.ts'

const EXAMPLE_ROWS: RadarRow[] = [
  {
    company_num: '600001',
    company_name: 'Placeholder Bakery Limited',
    sector_label: 'Food and beverage service',
    routing_key: 'T12',
    filing_deadline: '2026-06-20',
    days_to_deadline: -140,
    days_overdue: 140,
    est_penalty_eur: 520,
  },
  {
    company_num: '600002',
    company_name: 'Placeholder Harbour Hotel DAC',
    sector_label: 'Accommodation',
    routing_key: 'P43',
    filing_deadline: '2026-09-07',
    days_to_deadline: -61,
    days_overdue: 61,
    est_penalty_eur: 283,
  },
  {
    company_num: '600003',
    company_name: 'Placeholder Quay Cafe Limited',
    sector_label: 'Food and beverage service',
    routing_key: 'T23',
    filing_deadline: '2026-11-12',
    days_to_deadline: 5,
    days_overdue: 0,
    est_penalty_eur: 0,
  },
]

const USES: { term: string; detail: string }[] = [
  {
    term: 'Find prospects',
    detail:
      'Ask for overdue companies by area and sector. A company that has missed its annual return needs help with its filings, and that is work for a practice.',
  },
  {
    term: 'Chase clients',
    detail:
      'Save your client company numbers once. Each morning, see which clients are overdue and which are due in the next seven days.',
  },
  {
    term: 'See the working',
    detail:
      'Every answer shows the filter, the query and the row count behind it. The AI only reads your question. The database does every date, count and penalty.',
  },
  {
    term: 'On your phone',
    detail:
      'Hear the answers read aloud on a desk phone or a work mobile. In this prototype the spoken answers are recorded ahead of time from the same data.',
  },
]

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-5">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <IconPhoneCall size={22} aria-hidden />
          Dialed In
        </span>
        <Link to="/login" className="ml-auto text-label font-semibold">
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pt-8 pb-16 lg:pt-16">
        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <h1 className="text-h1 font-semibold text-balance sm:text-display">
              Know which companies are about to miss a CRO filing deadline.
            </h1>
            <p className="max-w-xl text-graphite">
              Dialed In reads the Companies Registration Office&apos;s free daily register and
              answers plain questions about annual return deadlines: which of your clients to chase
              this week, and which local companies are already overdue and could use an accountant.
            </p>
            <Link to="/app" className="button-primary self-start no-underline">
              Open the app
            </Link>
          </div>

          <figure className="flex min-w-0 flex-col gap-3">
            <p className="text-label font-semibold text-ink">
              Which Cork hospitality companies are overdue?
            </p>
            <Ledger
              rows={EXAMPLE_ROWS}
              total={12}
              caption="Example answer with placeholder companies"
              compact
            />
            <figcaption className="text-micro text-graphite">
              Example answer. The companies are placeholders, not register data.
            </figcaption>
          </figure>
        </section>

        <section aria-labelledby="uses" className="flex flex-col gap-4">
          <h2 id="uses" className="text-h2 font-semibold">
            What it does for a practice
          </h2>
          <dl className="border-t border-ink">
            {USES.map((use) => (
              <div
                key={use.term}
                className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="font-semibold">{use.term}</dt>
                <dd className="max-w-2xl text-graphite">{use.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-micro text-graphite">
        Contains Companies Registration Office data, licensed under CC BY 4.0. Penalties are
        estimates, not legal advice.
      </footer>
    </div>
  )
}
