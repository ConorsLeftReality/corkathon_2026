import { IconFileSearch, IconListCheck, IconPhoneCall, IconTargetArrow } from '@tabler/icons-react'
import { Link } from 'react-router'
import { BentoGrid, BentoGridItem } from '#src/components/ui/bento-grid'
import { GlowingEffect } from '#src/components/ui/glowing-effect'
import { MagneticButton } from '#src/components/ui/magnetic-button'
import { Spotlight } from '#src/components/ui/spotlight'
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

const PAGE_GUTTER = 'w-full px-4 sm:px-6 lg:px-8'

function ProspectsArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 rounded-md bg-wash p-3">
      {[
        ['420', 'Placeholder Bakery Limited', 'T12, food and beverage'],
        ['96', 'Placeholder Quay Cafe Limited', 'T12, food and beverage'],
        ['61', 'Placeholder Lane Bistro Limited', 'T23, food and beverage'],
      ].map(([days, name, place]) => (
        <div key={name} className="flex items-center gap-3 rounded-sm bg-rim px-3 py-1.5">
          <span className="figure w-14 shrink-0 text-danger-deep">{days}</span>
          <span className="min-w-0">
            <span className="block truncate text-label font-semibold">{name}</span>
            <span className="block text-micro text-graphite">{place}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ClientsArt() {
  return (
    <div className="grid h-full grid-cols-2 gap-2 rounded-md bg-wash p-4">
      <div className="flex flex-col justify-end rounded-sm bg-rim p-3">
        <span className="figure text-danger-deep">2</span>
        <span className="text-micro text-graphite">clients overdue</span>
      </div>
      <div className="flex flex-col justify-end rounded-sm bg-rim p-3">
        <span className="figure text-warning-deep">3</span>
        <span className="text-micro text-graphite">due this week</span>
      </div>
    </div>
  )
}

function WorkingArt() {
  return (
    <pre className="h-full overflow-hidden rounded-md bg-wash p-4 font-mono text-micro text-ink">
      {`{
  "mode": "prospects",
  "overdue_only": true,
  "nace_prefixes": ["55", "56"],
  "area": "cork_county"
}`}
    </pre>
  )
}

const WAVE = [
  'h-3',
  'h-6',
  'h-10',
  'h-5',
  'h-12',
  'h-8',
  'h-4',
  'h-9',
  'h-14',
  'h-6',
  'h-10',
  'h-3',
]

function PhoneArt() {
  return (
    <div className="flex h-full items-center gap-5 rounded-md bg-wash p-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-signal text-rim">
        <IconPhoneCall size={26} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex h-14 items-center gap-1" aria-hidden>
          {WAVE.map((height, index) => (
            <span key={index} className={`w-1.5 rounded-full bg-signal/60 ${height}`} />
          ))}
        </div>
        <p className="text-label text-ink">
          &quot;Six Cork hospitality companies are overdue. The most overdue is Placeholder Bakery,
          420 days late.&quot;
        </p>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className={`${PAGE_GUTTER} flex items-center gap-3 py-5`}>
        <span className="flex items-center gap-2 font-semibold text-ink">
          <IconPhoneCall size={22} aria-hidden />
          Dialed In
        </span>
        <Link to="/login" className="ml-auto text-label font-semibold">
          Sign in
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-20 pb-16">
        <section className="relative isolate overflow-hidden">
          <Spotlight className="-top-40 left-0 text-edge-cool md:-top-24 md:left-40" />
          <div
            className={`${PAGE_GUTTER} relative grid items-center gap-12 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20`}
          >
            <div className="flex flex-col gap-7">
              <h1 className="max-w-[18ch] text-h1 font-semibold text-balance sm:text-display xl:text-hero">
                Know which companies are about to miss a CRO filing deadline.
              </h1>
              <p className="max-w-xl text-graphite">
                Dialed In reads the Companies Registration Office&apos;s free daily register and
                answers plain questions about annual return deadlines: which of your clients to
                chase this week, and which local companies are already overdue and could use an
                accountant.
              </p>
              <MagneticButton className="self-start">
                <Link
                  to="/app"
                  className="inline-flex h-12 items-center rounded-full bg-signal px-7 font-semibold text-rim no-underline hover:bg-signal-deep"
                >
                  Open the app
                </Link>
              </MagneticButton>
            </div>

            <figure className="flex min-w-0 flex-col gap-3">
              <p className="text-label font-semibold text-ink">
                Which Cork hospitality companies are overdue?
              </p>
              <div className="relative rounded-md shadow-overlay">
                <GlowingEffect spread={32} />
                <Ledger
                  rows={EXAMPLE_ROWS}
                  total={12}
                  caption="Example answer with placeholder companies"
                  compact
                />
              </div>
              <figcaption className="text-micro text-graphite">
                Example answer. The companies are placeholders, not register data.
              </figcaption>
            </figure>
          </div>
        </section>

        <section aria-labelledby="uses" className={`${PAGE_GUTTER} flex flex-col gap-6`}>
          <h2 id="uses" className="text-h1 font-semibold">
            What it does for a practice
          </h2>
          <BentoGrid>
            <BentoGridItem
              className="md:col-span-2"
              title="Find prospects"
              description="Ask for overdue companies by area and sector. A company that has missed its annual return needs help with its filings, and that is work for a practice."
              header={<ProspectsArt />}
              icon={<IconTargetArrow size={20} aria-hidden />}
            />
            <BentoGridItem
              title="Chase clients"
              description="Save your client company numbers once. Each morning, see which clients are overdue and which are due in the next seven days."
              header={<ClientsArt />}
              icon={<IconListCheck size={20} aria-hidden />}
            />
            <BentoGridItem
              title="See the working"
              description="Every answer shows the filter, the query and the row count behind it. The database does every date, count and penalty."
              header={<WorkingArt />}
              icon={<IconFileSearch size={20} aria-hidden />}
            />
            <BentoGridItem
              className="md:col-span-2"
              title="On your phone"
              description="Hear the answers read aloud on a desk phone or a work mobile. In this prototype the spoken answers are recorded ahead of time from the same data."
              header={<PhoneArt />}
              icon={<IconPhoneCall size={20} aria-hidden />}
            />
          </BentoGrid>
        </section>
      </main>

      <footer className={`${PAGE_GUTTER} pb-8 text-micro text-graphite`}>
        Contains Companies Registration Office data, licensed under CC BY 4.0. Penalties are
        estimates, not legal advice.
      </footer>
    </div>
  )
}
