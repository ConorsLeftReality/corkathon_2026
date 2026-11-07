import { useSession } from '#src/features/auth/SessionProvider.tsx'
import { NotesPanel } from '#src/features/notes/NotesPanel.tsx'

export function NotesPage() {
  const { onSessionLost } = useSession()
  return <NotesPanel onSessionLost={onSessionLost} />
}
