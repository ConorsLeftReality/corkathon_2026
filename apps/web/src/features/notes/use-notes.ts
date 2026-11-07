import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import { createNote, deleteNote, fetchNotes } from '#src/features/notes/notes-api.ts'
import type { Note } from '#src/features/notes/notes-api.ts'

export type NotesState =
  { status: 'loading' } | { status: 'ready'; notes: Note[] } | { status: 'error'; message: string }

export function useNotes(onSessionLost: () => void) {
  const [state, setState] = useState<NotesState>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const handleError = useCallback(
    (error: unknown, report: (message: string) => void) => {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) onSessionLost()
      else report(error.message)
    },
    [onSessionLost],
  )

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', notes: await fetchNotes() })
    } catch (error) {
      handleError(error, (message) => {
        setState({ status: 'error', message })
      })
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  async function add(body: string): Promise<boolean> {
    setActionError(null)
    try {
      const note = await createNote(body)
      setState((current) =>
        current.status === 'ready' ? { ...current, notes: [note, ...current.notes] } : current,
      )
      return true
    } catch (error) {
      handleError(error, setActionError)
      return false
    }
  }

  async function remove(id: number): Promise<void> {
    setActionError(null)
    try {
      await deleteNote(id)
      setState((current) =>
        current.status === 'ready'
          ? { ...current, notes: current.notes.filter((note) => note.id !== id) }
          : current,
      )
    } catch (error) {
      handleError(error, setActionError)
    }
  }

  return { state, actionError, retry: load, add, remove }
}
