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

function placeLine(row: RadarRow): string {
  return [row.sector_label, row.routing_key].filter(Boolean).join(', ')
}

function LedgerRow({ row }: { row: RadarRow }) {
  const due = dueStatus(row)
  const penalty = formatPenalty(row.est_penalty_eur)
  return (
    <tr className="border-b border-rule align-top">
      <td className="w-20 py-3 pr-3 md:w-24">
        <span className={cn('figure block', TONE_CLASS[due.tone])}>{due.figure}</span>
        <span className="text-micro text-graphite">{due.unit}</span>
      </td>
      <th scope="row" className="py-3 pr-3 text-left font-normal">
        <span className="block font-semibold break-words">{row.company_name}</span>
        <span className="block text-label text-graphite tabular">
          {row.company_num}
          <span className="md:hidden">
            {placeLine(row) && `, ${placeLine(row)}`}. Deadline {formatDate(row.filing_deadline)}
            {penalty && `, ${penalty}`}
          </span>
        </span>
      </th>
      <td className="hidden py-3 pr-3 text-label md:table-cell">{row.routing_key ?? 'None'}</td>
      <td className="hidden py-3 pr-3 text-label md:table-cell">{row.sector_label ?? 'Unknown'}</td>
      <td className="hidden py-3 pr-3 text-label whitespace-nowrap tabular md:table-cell">
        {formatDate(row.filing_deadline)}
      </td>
      <td className="hidden py-3 text-right text-label whitespace-nowrap tabular md:table-cell">
        {penalty}
      </td>
    </tr>
  )
}

export function Ledger({ rows, total }: { rows: RadarRow[]; total: number }) {
  if (rows.length === 0) return null
  return (
    <div className="inset px-4 pt-1 pb-4">
      <table className="w-full border-collapse">
        <caption className="sr-only">Companies that match, most urgent first</caption>
        <thead>
          <tr className="border-b border-ink text-left text-micro text-graphite">
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Company
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-medium md:table-cell">
              Area
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-medium md:table-cell">
              Sector
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-medium md:table-cell">
              Deadline
            </th>
            <th scope="col" className="hidden py-2 text-right font-medium md:table-cell">
              Est. penalty
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LedgerRow key={row.company_num} row={row} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            {/* the double rule is how a ledger marks a total */}
            <td colSpan={6} className="border-t-[3px] border-double border-ink pt-2 text-label">
              {formatRowCount(total, rows.length)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
