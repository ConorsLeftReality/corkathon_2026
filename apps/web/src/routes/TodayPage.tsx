import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { TodayPanel } from '#src/features/filings/TodayPanel.tsx'

export function TodayPage() {
  const { onSessionLost } = useSession()
  return <TodayPanel onSessionLost={onSessionLost} />
}
