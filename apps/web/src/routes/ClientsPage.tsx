import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { ClientsPanel } from '#src/features/clients/ClientsPanel.tsx'

export function ClientsPage() {
  const { onSessionLost } = useSession()
  return <ClientsPanel onSessionLost={onSessionLost} />
}
