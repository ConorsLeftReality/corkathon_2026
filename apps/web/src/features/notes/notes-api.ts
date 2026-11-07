import { z } from 'zod'
import { apiRequest } from '#src/api/api-client.ts'

const noteSchema = z.object({ id: z.number(), body: z.string() })

export type Note = z.infer<typeof noteSchema>

export async function fetchNotes(): Promise<Note[]> {
  const { notes } = await apiRequest('/api/notes', z.object({ notes: z.array(noteSchema) }))
  return notes
}

export async function createNote(body: string): Promise<Note> {
  const options = { method: 'POST', body: { body } } as const
  const { note } = await apiRequest('/api/notes', z.object({ note: noteSchema }), options)
  return note
}

export async function deleteNote(id: number): Promise<void> {
  await apiRequest(`/api/notes/${id}`, z.undefined(), { method: 'DELETE' })
}
