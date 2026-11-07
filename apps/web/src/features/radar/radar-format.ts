const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const SOON_DAYS = 14

// utc on both sides so a register date never slides a day in another time zone
const DATE_FORMAT = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const EURO_FORMAT = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 })

export function formatDate(iso: string): string {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`not an iso date: ${iso}`)
  const [, year = '', month = '', day = ''] = match
  return DATE_FORMAT.format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))))
}

export function formatPenalty(euro: number): string {
  return euro > 0 ? `about €${EURO_FORMAT.format(euro)}` : ''
}

export type DueTone = 'overdue' | 'soon' | 'later'

export type DueStatus = { figure: string; unit: string; tone: DueTone }

type DueFields = { days_overdue: number; days_to_deadline: number }

export function dueStatus({ days_overdue, days_to_deadline }: DueFields): DueStatus {
  if (days_overdue > 0) {
    return {
      figure: String(days_overdue),
      unit: days_overdue === 1 ? 'day late' : 'days late',
      tone: 'overdue',
    }
  }
  if (days_to_deadline === 0) return { figure: '0', unit: 'due today', tone: 'soon' }
  return {
    figure: String(days_to_deadline),
    unit: days_to_deadline === 1 ? 'day left' : 'days left',
    tone: days_to_deadline <= SOON_DAYS ? 'soon' : 'later',
  }
}

export function formatRowCount(total: number, shown: number): string {
  if (total === 0) return 'No companies matched'
  const matched = `${total} ${total === 1 ? 'company' : 'companies'} matched`
  return shown < total ? `${matched}, showing the first ${shown}` : matched
}
