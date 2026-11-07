import { IconCopy, IconPhoneCall, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { GlowingEffect } from '#src/components/ui/glowing-effect'
import { cn } from '#src/lib/cn'
import { FilingsTable } from '#src/features/filings/FilingsTable.tsx'
import type { FilingReport } from '#src/features/filings/filings-api.ts'
import { useFilings } from '#src/features/filings/use-filings.ts'
import { formatDate } from '#src/features/radar/radar-format.ts'

const TODAY_FORMAT = new Intl.DateTimeFormat('en-IE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const TIME_FORMAT = new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit' })

function builtAt(generatedAt: string): string {
  const when = new Date(generatedAt)
  return Number.isNaN(when.getTime()) ? generatedAt : TIME_FORMAT.format(when)
}

type Tile = { label: string; count: number; tone: string }

function StatTiles({ report }: { report: FilingReport }) {
  const count = (status: string) => report.counts[status] ?? 0
  const tiles: Tile[] = [
    { label: 'Overdue', count: count('overdue'), tone: 'text-danger-deep' },
    {
      label: `Due in the next ${report.window_days} days`,
      count: count('due'),
      tone: 'text-warning-deep',
    },
    { label: 'On track', count: count('ok'), tone: 'text-ink' },
    {
      label: 'Not found or no date',
      count: count('not_found') + count('unknown') + count('dissolved'),
      tone: 'text-graphite',
    },
  ]
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Clients by filing status">
      {tiles.map((tile) => (
        <li
          key={tile.label}
          className="relative flex flex-col gap-1 rounded-lg border border-line bg-rim p-4 shadow-raised"
        >
          <GlowingEffect />
          <span className={cn('figure relative text-[2.5rem]', tile.tone)}>{tile.count}</span>
          <span className="relative text-label text-graphite">{tile.label}</span>
        </li>
      ))}
    </ul>
  )
}

function BriefingCard({ briefing }: { briefing: ReturnType<typeof useFilings>['briefing'] }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <section
      aria-labelledby="briefing-heading"
      className="relative flex flex-col gap-3 rounded-lg border border-line bg-rim p-4 shadow-raised"
    >
      <GlowingEffect />
      <div className="relative flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-rim">
          <IconPhoneCall size={18} aria-hidden />
        </span>
        <h2 id="briefing-heading" className="font-semibold">
          What the phone reads
        </h2>
      </div>
      <p className="relative text-label text-graphite">
        This is the briefing text sent to ElevenLabs for the spoken answer.
      </p>
      {briefing.status === 'loading' && (
        <p role="status" className="relative text-label text-graphite">
          Loading the briefing.
        </p>
      )}
      {briefing.status === 'error' && (
        <p role="alert" className="relative text-label text-danger-deep">
          Could not load the briefing. {briefing.message}
        </p>
      )}
      {briefing.status === 'ready' && (
        <>
          <pre className="relative max-h-96 overflow-y-auto rounded-md bg-wash p-3 font-sans text-label whitespace-pre-wrap text-ink">
            {briefing.value}
          </pre>
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-rim px-3 py-1.5 text-label font-semibold text-ink hover:border-signal"
              onClick={() => void copy(briefing.value)}
            >
              <IconCopy size={16} aria-hidden />
              Copy briefing
            </button>
            {copied === 'done' && (
              <span role="status" className="text-label text-success-deep">
                Briefing copied
              </span>
            )}
            {copied === 'failed' && (
              <span role="alert" className="text-label text-danger-deep">
                Could not copy. Select the text and copy it instead.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export function TodayPanel() {
  const { report, briefing, retry, rebuild, rebuilding, rebuildError } = useFilings()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1 font-semibold">Today</h1>
          <p className="text-graphite">{TODAY_FORMAT.format(new Date())}</p>
          {report.status === 'ready' && (
            <p className="text-label text-graphite">
              Report for {formatDate(report.value.as_of)}, built at{' '}
              {builtAt(report.value.generated_at)} from the CRO daily snapshot.
            </p>
          )}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-rim px-3 py-2 text-label font-semibold text-ink hover:border-signal disabled:cursor-wait disabled:opacity-70"
          disabled={rebuilding}
          onClick={() => void rebuild()}
        >
          <IconRefresh size={16} aria-hidden />
          Rebuild report
        </button>
      </header>

      {rebuilding && (
        <p role="status" className="text-label text-graphite">
          Rebuilding the report. This can take a minute when a new CRO file has to download.
        </p>
      )}
      {rebuildError && (
        <p role="alert" className="text-label text-danger-deep">
          Could not rebuild the report. {rebuildError}
        </p>
      )}

      {report.status === 'loading' && (
        <p role="status" className="text-graphite">
          Loading today&apos;s filing report.
        </p>
      )}
      {report.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-danger-deep">
            {report.message}
          </p>
          <button className="button-primary" type="button" onClick={() => void retry()}>
            Load the report again
          </button>
        </div>
      )}
      {report.status === 'ready' && <ReportBody report={report.value} briefing={briefing} />}
    </div>
  )
}

type ReportBodyProps = { report: FilingReport; briefing: ReturnType<typeof useFilings>['briefing'] }

function ReportBody({ report, briefing }: ReportBodyProps) {
  const overdue = report.companies.filter((company) => company.status === 'overdue')
  const due = report.companies.filter((company) => company.status === 'due')

  if (report.companies.length === 0) {
    return (
      <p className="inset px-4 py-3 text-graphite">
        No clients in the report yet. Add company numbers to my_companies.csv on the filings server,
        then rebuild the report.
      </p>
    )
  }

  return (
    <>
      <StatTiles report={report} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <ReportSection
            title="Overdue"
            empty="None of your clients are overdue."
            companies={overdue}
          />
          <ReportSection
            title={`Due in the next ${report.window_days} days`}
            empty={`No clients are due in the next ${report.window_days} days.`}
            companies={due}
          />
        </div>
        <div className="flex flex-col gap-4">
          <BriefingCard briefing={briefing} />
          <p className="text-label text-graphite">
            Your client list is my_companies.csv on the filings server. Edit it, then rebuild the
            report.
          </p>
        </div>
      </div>
      <p className="text-micro text-graphite">
        {report.source} Deadlines are the next annual return date plus {report.grace_days} days.
      </p>
    </>
  )
}

type ReportSectionProps = {
  title: string
  empty: string
  companies: FilingReport['companies']
}

function ReportSection({ title, empty, companies }: ReportSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-h2 font-semibold">{title}</h2>
      {companies.length === 0 ? (
        <p className="text-graphite">{empty}</p>
      ) : (
        <FilingsTable companies={companies} caption={`Your clients: ${title.toLowerCase()}`} />
      )}
    </section>
  )
}
