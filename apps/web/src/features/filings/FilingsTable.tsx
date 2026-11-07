import { cn } from '#src/lib/cn'
import type { FilingCompany } from '#src/features/filings/filings-api.ts'
import { dueStatus, formatDate } from '#src/features/radar/radar-format.ts'
import type { DueTone } from '#src/features/radar/radar-format.ts'

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-danger-deep',
  soon: 'text-warning-deep',
  later: 'text-ink',
}

const NO_DEADLINE_LABEL: Record<string, string> = {
  not_found: 'Not in the register',
  unknown: 'No return date',
  dissolved: 'Dissolved',
}

const WIDE_CELL = 'hidden md:table-cell'

function StatusCell({ company }: { company: FilingCompany }) {
  if (company.days_left === null) {
    return (
      <span className="text-label text-graphite">
        {NO_DEADLINE_LABEL[company.status] ?? 'Unknown'}
      </span>
    )
  }
  const due = dueStatus({
    days_overdue: Math.max(0, -company.days_left),
    days_to_deadline: company.days_left,
  })
  return (
    <>
      <span className={cn('figure block', TONE_CLASS[due.tone])}>{due.figure}</span>
      <span className="text-micro text-graphite">{due.unit}</span>
    </>
  )
}

function dateOrDash(iso: string | null): string {
  return iso === null ? 'Not given' : formatDate(iso)
}

type FilingsTableProps = { companies: FilingCompany[]; caption: string }

export function FilingsTable({ companies, caption }: FilingsTableProps) {
  if (companies.length === 0) return null
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
            <th scope="col" className={cn('py-2 pr-3 font-medium', WIDE_CELL)}>
              Filing deadline
            </th>
            <th scope="col" className={cn('py-2 pr-3 font-medium', WIDE_CELL)}>
              Annual return date
            </th>
            <th scope="col" className={cn('py-2 font-medium', WIDE_CELL)}>
              CRO status
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.company_num} className="border-b border-rule align-top">
              <td className="w-24 py-3 pr-3 md:w-28">
                <StatusCell company={company} />
              </td>
              <th scope="row" className="py-3 pr-3 text-left font-normal">
                <span className="block font-semibold wrap-break-word">
                  {company.company_name || `Company ${company.company_num}`}
                </span>
                <span className="block text-label text-graphite tabular">
                  {company.company_num}
                  {company.address && `, ${company.address}`}
                  <span className="md:hidden">
                    {company.deadline && `. Deadline ${formatDate(company.deadline)}`}
                  </span>
                </span>
              </th>
              <td className={cn('py-3 pr-3 text-label whitespace-nowrap tabular', WIDE_CELL)}>
                {dateOrDash(company.deadline)}
              </td>
              <td className={cn('py-3 pr-3 text-label whitespace-nowrap tabular', WIDE_CELL)}>
                {dateOrDash(company.nard)}
              </td>
              <td className={cn('py-3 text-label', WIDE_CELL)}>
                {company.company_status || 'Not given'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {/* the double rule is how a ledger marks a total */}
            <td colSpan={5} className="border-t-[3px] border-double border-ink pt-2 text-label">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
