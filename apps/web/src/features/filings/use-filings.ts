import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import { filingsApi } from '#src/features/filings/filings-api.ts'
import type { FilingReport } from '#src/features/filings/filings-api.ts'

type Loadable<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string }

export function useFilings(onSessionLost: () => void) {
  const messageOf = useCallback(
    (error: unknown): string => {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) onSessionLost()
      return error.message
    },
    [onSessionLost],
  )

  const [report, setReport] = useState<Loadable<FilingReport>>({ status: 'loading' })
  const [briefing, setBriefing] = useState<Loadable<string>>({ status: 'loading' })
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildError, setRebuildError] = useState<string | null>(null)

  const loadBriefing = useCallback(async () => {
    setBriefing({ status: 'loading' })
    try {
      setBriefing({ status: 'ready', value: await filingsApi.fetchBriefing() })
    } catch (error) {
      setBriefing({ status: 'error', message: messageOf(error) })
    }
  }, [messageOf])

  const load = useCallback(async () => {
    setReport({ status: 'loading' })
    void loadBriefing()
    try {
      setReport({ status: 'ready', value: await filingsApi.fetchReport() })
    } catch (error) {
      setReport({ status: 'error', message: messageOf(error) })
    }
  }, [loadBriefing, messageOf])

  useEffect(() => {
    void load()
  }, [load])

  async function rebuild() {
    setRebuilding(true)
    setRebuildError(null)
    try {
      setReport({ status: 'ready', value: await filingsApi.refreshReport() })
      void loadBriefing()
    } catch (error) {
      setRebuildError(messageOf(error))
    } finally {
      setRebuilding(false)
    }
  }

  return { report, briefing, retry: load, rebuild, rebuilding, rebuildError }
}
