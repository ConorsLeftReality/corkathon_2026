import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { assertNever } from '#src/assert-never.ts'
import type { Note } from '#src/features/notes/notes-api.ts'
import { useNotes } from '#src/features/notes/use-notes.ts'
import type { NotesState } from '#src/features/notes/use-notes.ts'

function NoteList({ notes, onDelete }: { notes: Note[]; onDelete: (id: number) => void }) {
  if (notes.length === 0) return <p className="text-graphite">No notes yet. Add your first one.</p>
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start justify-between gap-4 surface p-4">
          <p className="min-w-0 break-words">{note.body}</p>
          <button
            className="button-quiet shrink-0"
            type="button"
            aria-label={`Delete note: ${note.body}`}
            onClick={() => {
              onDelete(note.id)
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}

type NotesBodyProps = {
  state: NotesState
  onRetry: () => void
  onDelete: (id: number) => void
}

function NotesBody({ state, onRetry, onDelete }: NotesBodyProps) {
  switch (state.status) {
    case 'loading':
      return <p role="status">Loading notes.</p>
    case 'error':
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-danger-deep">
            {state.message}
          </p>
          <button className="button-primary" type="button" onClick={onRetry}>
            Load notes again
          </button>
        </div>
      )
    case 'ready':
      return <NoteList notes={state.notes} onDelete={onDelete} />
    default:
      return assertNever(state)
  }
}

export function NotesPanel({ onSessionLost }: { onSessionLost: () => void }) {
  const { state, actionError, retry, add, remove } = useNotes(onSessionLost)
  const [draft, setDraft] = useState('')
  const draftId = useId()

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (await add(draft)) setDraft('')
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold">Notes</h1>
      <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
        <label htmlFor={draftId}>New note</label>
        <div className="flex gap-2">
          <input
            id={draftId}
            className="field min-w-0 flex-1"
            required
            maxLength={2000}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
          />
          <button className="button-primary" type="submit">
            Add note
          </button>
        </div>
      </form>
      {actionError && (
        <p role="alert" className="text-danger-deep">
          {actionError}
        </p>
      )}
      <NotesBody state={state} onRetry={() => void retry()} onDelete={(id) => void remove(id)} />
    </section>
  )
}
