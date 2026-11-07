import type { ReactNode } from 'react'
import type { RadarAnswer } from '#src/features/radar/radar-api.ts'
import { formatDate } from '#src/features/radar/radar-format.ts'

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 border-l-2 border-rule pl-4 marker:font-semibold marker:text-graphite">
      <h3 className="text-label font-semibold">{title}</h3>
      {children}
    </li>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-sm bg-wash p-3 font-mono text-micro whitespace-pre-wrap text-ink wrap-anywhere">
      <code>{children}</code>
    </pre>
  )
}

type WorkingPaperProps = { question: string; fromPreset: boolean; response: RadarAnswer }

export function WorkingPaper({ question, fromPreset, response }: WorkingPaperProps) {
  return (
    <details className="inset group">
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-signal">
        <h2 className="inline text-body font-semibold underline underline-offset-4 group-open:no-underline">
          How this was worked out
        </h2>
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-4 pt-4 pb-5">
        <p className="text-label text-graphite">
          {fromPreset
            ? 'No AI was used. This example question runs a stored filter, and the database did the rest, including every date, count and penalty.'
            : 'The AI only turned your question into the filter in step 2. The database did the rest, including every date, count and penalty.'}
        </p>
        <ol className="flex list-decimal flex-col gap-5 pl-5">
          <Step title="Your question">
            <p className="wrap-break-word">{question}</p>
          </Step>
          <Step title={fromPreset ? 'The stored filter' : 'The filter the AI chose'}>
            <Code>{JSON.stringify(response.filter, null, 2)}</Code>
          </Step>
          <Step title="The query that ran">
            <Code>{response.sql}</Code>
            <p className="text-label text-graphite">
              Values passed in separately:{' '}
              <span className="font-mono text-micro break-all text-ink">
                {JSON.stringify(response.params)}
              </span>
            </p>
          </Step>
          <Step title="The data">
            <p className="text-label tabular">
              {response.row_count} rows matched in the CRO Company Records snapshot. Newest company
              in the file registered on {formatDate(response.snapshot.newest_reg_date)}.
            </p>
          </Step>
        </ol>
      </div>
    </details>
  )
}
