import type { RadarSnapshot } from '#src/features/radar/radar-api.ts'
import { formatDate } from '#src/features/radar/radar-format.ts'

export function SnapshotLine({ snapshot }: { snapshot: RadarSnapshot }) {
  const date = formatDate(snapshot.newest_reg_date)
  if (snapshot.stale) {
    return (
      <p role="note" className="rounded-md bg-warning-tint px-4 py-3 text-label text-warning-deep">
        This data is from {date} and may be out of date. Deadlines can have moved since then.
      </p>
    )
  }
  return <p className="text-label text-graphite">From the CRO register, up to date as of {date}.</p>
}
