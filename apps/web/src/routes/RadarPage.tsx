import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { RadarPanel } from '#src/features/radar/RadarPanel.tsx'

export function RadarPage() {
  const { onSessionLost } = useSession()
  return <RadarPanel onSessionLost={onSessionLost} />
}
