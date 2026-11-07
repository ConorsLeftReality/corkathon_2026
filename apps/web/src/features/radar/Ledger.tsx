import { cn } from '#src/lib/cn'
import type { RadarRow } from '#src/features/radar/radar-api.ts'
import {
  dueStatus,
  formatDate,
  formatPenalty,
  formatRowCount,
} from '#src/features/radar/radar-format.ts'
import type { DueTone } from '#src/features/radar/radar-format.ts'

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-danger-deep',
  soon: 'text-warning-deep',
  later: 'text-ink',
}

const WIDE_CELL = 'hidden md:table-cell'

function placeLine(row: RadarRow): string {
  return [row.sector_label, row.routing_key].filter(Boolean).join(', ')
}

function LedgerRow({ row, compact }: { row: RadarRow; compact: boolean }) {
  const due = dueStatus(row)
  const penalty = formatPenalty(row.est_penalty_eur)
  return (
    <tr className="border-b border-rule align-top">
      <td className={cn('w-20 py-3 pr-3', !compact && 'md:w-24')}>
        <span className={cn('figure block', TONE_CLASS[due.tone])}>{due.figure}</span>
        <span className="text-micro text-graphite">{due.unit}</span>
      </td>
      <th scope="row" className="py-3 pr-3 text-left font-normal">
        <span className="block font-semibold wrap-break-word">{row.company_name}</span>
        <span className="block text-label text-graphite tabular">
          {row.company_num}
          <span className={cn(!compact && 'md:hidden')}>
            {placeLine(row) && `, ${placeLine(row)}`}. Deadline {formatDate(row.filing_deadline)}
            {penalty && `, ${penalty}`}
          </span>
        </span>
      </th>
      {!compact && (
        <>
          <td className={cn('py-3 pr-3 text-label', WIDE_CELL)}>{row.routing_key ?? 'None'}</td>
          <td className={cn('py-3 pr-3 text-label', WIDE_CELL)}>{row.sector_label ?? 'Unknown'}</td>
          <td className={cn('py-3 pr-3 text-label whitespace-nowrap tabular', WIDE_CELL)}>
            {formatDate(row.filing_deadline)}
          </td>
          <td className={cn('py-3 text-right text-label whitespace-nowrap tabular', WIDE_CELL)}>
            {penalty}
          </td>
        </>
      )}
    </tr>
  )
}

type LedgerProps = {
  rows: RadarRow[]
  total: number
  caption?: string
  // two columns at every width, for narrow spots like the landing example
  compact?: boolean
}

export function Ledger({
  rows,
  total,
  caption = 'Companies that match, most urgent first',
  compact = false,
}: LedgerProps) {
  if (rows.length === 0) return null
  return (
    <div className="inset px-4 pt-1 pb-4">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink text-left text-micro text-graphite">
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Company
            </th>
            {!compact && (
              <>
                <th scope="col" className={cn('py-2 pr-3 font-medium', WIDE_CELL)}>
                  Area
                </th>
                <th scope="col" className={cn('py-2 pr-3 font-medium', WIDE_CELL)}>
                  Sector
                </th>
                <th scope="col" className={cn('py-2 pr-3 font-medium', WIDE_CELL)}>
                  Deadline
                </th>
                <th
                  scope="col"
                  className={cn('py-2 text-right font-medium whitespace-nowrap', WIDE_CELL)}
                >
                  Est. penalty
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LedgerRow key={row.company_num} row={row} compact={compact} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            {/* the double rule is how a ledger marks a total */}
            <td
              colSpan={compact ? 2 : 6}
              className="border-t-[3px] border-double border-ink pt-2 text-label"
            >
              {formatRowCount(total, rows.length)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
