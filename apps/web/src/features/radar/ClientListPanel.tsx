import { useId, useState } from 'react'
import type { ChangeEvent, SubmitEvent } from 'react'
import { CLIENT_LIST_MAX, parseCompanyNumbers } from '#src/features/radar/client-numbers.ts'

const FILE_MAX_BYTES = 1024 * 1024
const GROUPED = new Intl.NumberFormat('en-IE')

function plural(count: number, one: string, many: string): string {
  return `${GROUPED.format(count)} ${count === 1 ? one : many}`
}

function SavedNumbers({ numbers }: { numbers: string[] }) {
  if (numbers.length === 0) {
    return <p className="text-graphite">No clients saved yet.</p>
  }
  return (
    <details className="group">
      <summary className="cursor-pointer text-signal">
        <span className="underline underline-offset-4 group-open:no-underline">
          {plural(numbers.length, 'client', 'clients')} saved. Show the numbers.
        </span>
      </summary>
      <ul className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-label tabular">
        {numbers.map((number) => (
          <li key={number}>{number}</li>
        ))}
      </ul>
    </details>
  )
}

type ClientListPanelProps = {
  saved: string[]
  saving: boolean
  saveError: string | null
  onSave: (numbers: string[]) => Promise<boolean>
}

export function ClientListPanel({ saved, saving, saveError, onSave }: ClientListPanelProps) {
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const draftId = useId()
  const hintId = useId()
  const fileId = useId()
  const parsed = parseCompanyNumbers(draft)

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > FILE_MAX_BYTES) {
      setProblem('That file is over 1 MB. Save a CSV with only the company numbers and try again.')
      return
    }
    setProblem(null)
    setJustSaved(false)
    setDraft(await file.text())
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setJustSaved(false)
    if (parsed.numbers.length === 0) {
      setProblem('Add at least one company number.')
      return
    }
    setProblem(null)
    if (await onSave(parsed.numbers)) {
      setDraft('')
      setJustSaved(true)
    }
  }

  const error = problem ?? saveError

  return (
    <div className="flex flex-col gap-4">
      <SavedNumbers numbers={saved} />
      <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={draftId} className="font-semibold">
            Company numbers
          </label>
          <p id={hintId} className="text-label text-graphite">
            One per line or separated by commas, as copied from a spreadsheet. Saving replaces your
            current list.
          </p>
          <textarea
            id={draftId}
            aria-describedby={hintId}
            aria-invalid={problem !== null}
            className="field min-h-32 font-mono text-label"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setJustSaved(false)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="text-label font-semibold">
            Or choose a CSV or text file
          </label>
          <input
            id={fileId}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="text-label file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-line-strong file:bg-rim file:px-3 file:py-1.5 file:text-ink"
            onChange={(event) => void readFile(event)}
          />
        </div>
        {draft.trim() !== '' && (
          <p className="text-label tabular" aria-live="polite">
            Ready to save {plural(parsed.numbers.length, 'number', 'numbers')}.
            {parsed.skipped.length > 0 &&
              ` Skipped ${plural(parsed.skipped.length, 'entry', 'entries')} that ${parsed.skipped.length === 1 ? 'is' : 'are'} not a company number: ${parsed.skipped.slice(0, 3).join(', ')}${parsed.skipped.length > 3 ? ' and more' : ''}.`}
            {parsed.tooMany && ` Only the first ${GROUPED.format(CLIENT_LIST_MAX)} will be saved.`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-label text-danger-deep">
            {error}
          </p>
        )}
        {justSaved && (
          <p role="status" className="text-label text-success-deep">
            Client list saved.
          </p>
        )}
        <button className="button-primary self-start" type="submit" disabled={saving}>
          Save client list
        </button>
      </form>
    </div>
  )
}
