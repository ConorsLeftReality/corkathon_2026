import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import { assertNever } from '#src/assert-never.ts'
import { cn } from '#src/lib/cn'
import { Ledger } from '#src/features/radar/Ledger.tsx'
import { PRESETS, QUESTION_MAX_LENGTH } from '#src/features/radar/radar-api.ts'
import type { RadarMode } from '#src/features/radar/radar-api.ts'
import { SnapshotLine } from '#src/features/radar/SnapshotLine.tsx'
import { useRadar } from '#src/features/radar/use-radar.ts'
import type { RadarState } from '#src/features/radar/use-radar.ts'
import { WorkingPaper } from '#src/features/radar/WorkingPaper.tsx'

const MODES: { value: RadarMode; label: string; hint: string }[] = [
  { value: 'prospects', label: 'Find prospects', hint: 'Search every company on the register' },
  { value: 'clients', label: 'My clients', hint: 'Search only your client list' },
]

type Preset = { id: string; question: string }

function ModeSwitch({ mode, onChange }: { mode: RadarMode; onChange: (mode: RadarMode) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">What to search</legend>
      <div className="inline-flex w-full rounded-md border border-line-strong bg-rim p-1 sm:w-auto sm:self-start">
        {MODES.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex-1 cursor-pointer rounded-sm px-4 py-2 text-center text-label font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal sm:flex-none',
              mode === option.value ? 'bg-signal text-rim' : 'text-graphite hover:bg-wash',
            )}
          >
            <input
              type="radio"
              name="radar-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => {
                onChange(option.value)
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <p className="text-label text-graphite">
        {MODES.find((option) => option.value === mode)?.hint}
      </p>
    </fieldset>
  )
}

function PresetList({
  presets,
  onPick,
}: {
  presets: readonly Preset[]
  onPick: (preset: Preset) => void
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Example questions">
      {presets.map((preset) => (
        <li key={preset.id}>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-line-strong bg-rim px-3 py-1.5 text-left text-label text-ink hover:border-signal"
            onClick={() => {
              onPick(preset)
            }}
          >
            {preset.question}
          </button>
        </li>
      ))}
    </ul>
  )
}

type ResultProps = {
  state: RadarState
  presets: readonly Preset[]
  onPick: (preset: Preset) => void
}

function RadarResult({ state, presets, onPick }: ResultProps) {
  switch (state.status) {
    case 'idle':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-graphite">Ask in your own words, or start with one of these.</p>
          <PresetList presets={presets} onPick={onPick} />
        </div>
      )
    case 'loading':
      return (
        <p role="status" className="text-graphite">
          Checking the register.
        </p>
      )
    case 'error':
      return (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-danger-deep">
            {state.message}
          </p>
          {state.code === 'radar_llm_unavailable' && (
            <>
              <p className="text-graphite">These questions still work, because they skip the AI.</p>
              <PresetList presets={presets} onPick={onPick} />
            </>
          )}
        </div>
      )
    case 'reply':
      return (
        <div className="flex flex-col gap-3">
          <p className="inset px-4 py-3 text-h2">{state.message}</p>
          <SnapshotLine snapshot={state.snapshot} />
        </div>
      )
    case 'answer':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-h2 font-semibold wrap-break-word" aria-live="polite">
              {state.response.answer}
            </p>
            <SnapshotLine snapshot={state.response.snapshot} />
          </div>
          <Ledger rows={state.response.rows} total={state.response.row_count} />
          <WorkingPaper
            question={state.question}
            fromPreset={state.fromPreset}
            response={state.response}
          />
        </div>
      )
    default:
      return assertNever(state)
  }
}

type RadarPanelProps = { initialMode: RadarMode; onSessionLost: () => void }

export function RadarPanel({ initialMode, onSessionLost }: RadarPanelProps) {
  const [mode, setMode] = useState<RadarMode>(initialMode)
  const [question, setQuestion] = useState('')
  const { state, ask, reset } = useRadar(mode, onSessionLost)
  const questionId = useId()
  const presets = PRESETS[mode]

  function changeMode(next: RadarMode) {
    setMode(next)
    reset()
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (trimmed !== '') void ask({ question: trimmed })
  }

  function pick(preset: Preset) {
    setQuestion(preset.question)
    void ask({ question: preset.question, preset: preset.id })
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-h1 font-semibold">Filing deadlines</h1>
      <ModeSwitch mode={mode} onChange={changeMode} />
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <label htmlFor={questionId} className="font-semibold">
          Your question
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={questionId}
            className="field min-w-0 flex-1"
            required
            maxLength={QUESTION_MAX_LENGTH}
            autoComplete="off"
            placeholder={presets[0].question}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value)
            }}
          />
          <button className="button-primary" type="submit" disabled={state.status === 'loading'}>
            Ask
          </button>
        </div>
      </form>
      <RadarResult state={state} presets={presets} onPick={pick} />
      <p className="mt-auto pt-6 text-micro text-graphite">
        Contains Companies Registration Office data, licensed under CC BY 4.0. Penalties are
        estimates, not legal advice.
      </p>
    </section>
  )
}
