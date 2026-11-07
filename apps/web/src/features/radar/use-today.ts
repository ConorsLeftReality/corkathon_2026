import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import {
  askRadar,
  fetchClientList,
  fetchSnapshot,
  saveClientList,
} from '#src/features/radar/radar-api.ts'
import type { RadarAnswer, RadarSnapshot } from '#src/features/radar/radar-api.ts'

type Loadable<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string }

function useErrorReporter(onSessionLost: () => void) {
  return useCallback(
    (error: unknown, report: (message: string) => void) => {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) onSessionLost()
      else report(error.message)
    },
    [onSessionLost],
  )
}

export function useSnapshot(onSessionLost: () => void) {
  const [state, setState] = useState<Loadable<RadarSnapshot>>({ status: 'loading' })
  const reportError = useErrorReporter(onSessionLost)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', value: await fetchSnapshot() })
    } catch (error) {
      reportError(error, (message) => {
        setState({ status: 'error', message })
      })
    }
  }, [reportError])

  useEffect(() => {
    void load()
  }, [load])

  return state
}

export function useClientList(onSessionLost: () => void) {
  const [state, setState] = useState<Loadable<string[]>>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const reportError = useErrorReporter(onSessionLost)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', value: await fetchClientList() })
    } catch (error) {
      reportError(error, (message) => {
        setState({ status: 'error', message })
      })
    }
  }, [reportError])

  useEffect(() => {
    void load()
  }, [load])

  async function save(numbers: string[]): Promise<boolean> {
    setSaving(true)
    setSaveError(null)
    try {
      setState({ status: 'ready', value: await saveClientList(numbers) })
      return true
    } catch (error) {
      reportError(error, setSaveError)
      return false
    } finally {
      setSaving(false)
    }
  }

  return { state, retry: load, save, saving, saveError }
}

export type Briefing = { overdue: RadarAnswer; week: RadarAnswer }

async function runPreset(preset: string): Promise<RadarAnswer> {
  const response = await askRadar({ mode: 'clients', preset })
  if (response.kind !== 'answer') throw new ApiError('bad_response', response.message, 200)
  return response
}

// the same two client queries the phone briefing reads out, so neither touches the ai
export function useBriefing(clients: string[] | null, onSessionLost: () => void) {
  const [state, setState] = useState<Loadable<Briefing>>({ status: 'loading' })
  const reportError = useErrorReporter(onSessionLost)
  const listKey = clients?.join(',') ?? null

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [overdue, week] = await Promise.all([
        runPreset('clients_overdue'),
        runPreset('clients_this_week'),
      ])
      setState({ status: 'ready', value: { overdue, week } })
    } catch (error) {
      reportError(error, (message) => {
        setState({ status: 'error', message })
      })
    }
  }, [reportError])

  useEffect(() => {
    if (listKey !== null && listKey !== '') void load()
  }, [listKey, load])

  return { state, retry: load }
}
