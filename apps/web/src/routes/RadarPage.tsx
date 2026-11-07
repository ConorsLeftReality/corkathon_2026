import { useSearchParams } from 'react-router'
import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { RadarPanel } from '#src/features/radar/RadarPanel.tsx'

export function RadarPage() {
  const { onSessionLost } = useSession()
  const [params] = useSearchParams()
  const initialMode = params.get('mode') === 'clients' ? 'clients' : 'prospects'
  return <RadarPanel initialMode={initialMode} onSessionLost={onSessionLost} />
}
