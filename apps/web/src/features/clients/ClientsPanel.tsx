import { IconUpload } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link } from 'react-router'
import { assertNever } from '#src/assert-never.ts'
import { COMPANY_NUMBER_PATTERN } from '#src/features/clients/clients-api.ts'
import type { Client, UploadMode, UploadResult } from '#src/features/clients/clients-api.ts'
import { plural, uploadSummary } from '#src/features/clients/clients-format.ts'
import { useClients } from '#src/features/clients/use-clients.ts'
import type { ClientsState } from '#src/features/clients/use-clients.ts'
import { formatDate } from '#src/features/radar/radar-format.ts'

const MAX_UPLOAD_BYTES = 1024 * 1024

function AddForm({ onAdd }: { onAdd: (companyNum: string) => Promise<boolean> }) {
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const inputId = useId()
  const hintId = useId()

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setSaving(true)
    if (await onAdd(number.trim())) setNumber('')
    setSaving(false)
  }

  return (
    <form className="flex flex-col gap-2 surface p-4" onSubmit={(event) => void submit(event)}>
      <h2 className="font-semibold">Add one company</h2>
      <label htmlFor={inputId}>CRO company number</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          className="field min-w-0 flex-1"
          inputMode="numeric"
          autoComplete="off"
          required
          pattern={COMPANY_NUMBER_PATTERN}
          maxLength={10}
          aria-describedby={hintId}
          value={number}
          onChange={(event) => {
            setNumber(event.target.value)
          }}
        />
        <button className="button-primary" type="submit" disabled={saving}>
          Add
        </button>
      </div>
      <p id={hintId} className="text-label text-graphite">
        Digits only, as shown on the CRO register.
      </p>
    </form>
  )
}

type UploadFormProps = { onUpload: (file: File, mode: UploadMode) => Promise<UploadResult | null> }

function UploadForm({ onUpload }: UploadFormProps) {
  const [mode, setMode] = useState<UploadMode>('add')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [tooBig, setTooBig] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const hintId = useId()

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (file === null) return
    setSummary(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setTooBig(true)
      return
    }
    setSaving(true)
    const result = await onUpload(file, mode)
    setSaving(false)
    if (result === null) return
    setSummary(uploadSummary(result))
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <form className="flex flex-col gap-3 surface p-4" onSubmit={(event) => void submit(event)}>
      <h2 className="font-semibold">Upload a CSV</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={fileId}>CSV file</label>
        <input
          id={fileId}
          ref={fileInput}
          className="field"
          type="file"
          accept=".csv,text/csv"
          required
          aria-describedby={hintId}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setTooBig(false)
            setSummary(null)
          }}
        />
        <p id={hintId} className="text-label text-graphite">
          One company number per row, in a column called company_num, or in the first column. Up to
          1 MB.
        </p>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">What should the file do?</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === 'add'}
            onChange={() => {
              setMode('add')
            }}
          />
          Add to my list
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === 'replace'}
            onChange={() => {
              setMode('replace')
            }}
          />
          Replace my whole list
        </label>
      </fieldset>
      {tooBig && (
        <p role="alert" className="text-danger-deep">
          That file is over 1 MB. Split it and upload each part.
        </p>
      )}
      <button
        className="button-primary inline-flex items-center gap-2 self-start"
        type="submit"
        disabled={saving}
      >
        <IconUpload size={16} aria-hidden />
        {mode === 'replace' ? 'Replace my list' : 'Upload and add'}
      </button>
      {saving && (
        <p role="status" className="text-label text-graphite">
          Uploading.
        </p>
      )}
      {summary && (
        <p role="status" className="text-success-deep">
          {summary}
        </p>
      )}
    </form>
  )
}

function ClientTable({ clients, onRemove }: { clients: Client[]; onRemove: (n: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-rim">
      <table className="w-full text-left">
        <caption className="sr-only">Your clients</caption>
        <thead className="text-label text-graphite">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2 font-semibold">
              Company number
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Added
            </th>
            <th scope="col" className="px-4 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.company_num} className="border-b border-line last:border-b-0">
              <th scope="row" className="figure px-4 py-2 font-normal">
                {client.company_num}
              </th>
              <td className="px-4 py-2 text-graphite">
                {formatDate(client.added_at.slice(0, 10))}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  className="button-quiet"
                  type="button"
                  aria-label={`Remove company ${client.company_num}`}
                  onClick={() => {
                    onRemove(client.company_num)
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type ClientsBodyProps = {
  state: ClientsState
  onRetry: () => void
  onRemove: (companyNum: string) => void
}

function ClientsBody({ state, onRetry, onRemove }: ClientsBodyProps) {
  switch (state.status) {
    case 'loading':
      return <p role="status">Loading your clients.</p>
    case 'error':
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-danger-deep">
            {state.message}
          </p>
          <button className="button-primary" type="button" onClick={onRetry}>
            Load clients again
          </button>
        </div>
      )
    case 'ready': {
      const { clients, limit } = state.list
      if (clients.length === 0) {
        return (
          <p className="inset px-4 py-3 text-graphite">
            No clients yet. Add a company number or upload a CSV to fill your Today report.
          </p>
        )
      }
      return (
        <div className="flex flex-col gap-2">
          <p className="text-label text-graphite">
            {plural(clients.length, 'company', 'companies')} of {limit}.{' '}
            <Link to="/app">See their deadlines on Today.</Link>
          </p>
          <ClientTable clients={clients} onRemove={onRemove} />
        </div>
      )
    }
    default:
      return assertNever(state)
  }
}

export function ClientsPanel({ onSessionLost }: { onSessionLost: () => void }) {
  const { state, actionError, retry, add, remove, upload } = useClients(onSessionLost)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1 font-semibold">Clients</h1>
        <p className="text-graphite">
          The companies on your Today report and phone briefing. Only your account can see this
          list.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <AddForm onAdd={add} />
        <UploadForm onUpload={upload} />
      </div>
      {actionError && (
        <p role="alert" className="text-danger-deep">
          {actionError}
        </p>
      )}
      <ClientsBody state={state} onRetry={() => void retry()} onRemove={(n) => void remove(n)} />
    </div>
  )
}
