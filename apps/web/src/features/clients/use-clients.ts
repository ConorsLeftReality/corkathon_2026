import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import {
  addClient,
  fetchClients,
  removeClient,
  uploadClients,
} from '#src/features/clients/clients-api.ts'
import type { ClientList, UploadMode, UploadResult } from '#src/features/clients/clients-api.ts'

export type ClientsState =
  | { status: 'loading' }
  | { status: 'ready'; list: ClientList }
  | { status: 'error'; message: string }

// the api's 413 comes from the framework with a generic message, so the code picks our own
const MESSAGES: Record<string, string> = {
  request_entity_too_large: 'That file is over 1 MB. Split it and upload each part.',
}

export function useClients(onSessionLost: () => void) {
  const [state, setState] = useState<ClientsState>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const handleError = useCallback(
    (error: unknown, report: (message: string) => void) => {
      if (!(error instanceof ApiError)) throw error
      if (error.status === 401) onSessionLost()
      else report(MESSAGES[error.code] ?? error.message)
    },
    [onSessionLost],
  )

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', list: await fetchClients() })
    } catch (error) {
      handleError(error, (message) => {
        setState({ status: 'error', message })
      })
    }
  }, [handleError])

  useEffect(() => {
    void load()
  }, [load])

  async function add(companyNum: string): Promise<boolean> {
    setActionError(null)
    try {
      setState({ status: 'ready', list: await addClient(companyNum) })
      return true
    } catch (error) {
      handleError(error, setActionError)
      return false
    }
  }

  async function remove(companyNum: string): Promise<void> {
    setActionError(null)
    try {
      await removeClient(companyNum)
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              list: {
                ...current.list,
                clients: current.list.clients.filter((c) => c.company_num !== companyNum),
              },
            }
          : current,
      )
    } catch (error) {
      handleError(error, setActionError)
    }
  }

  async function upload(file: File, mode: UploadMode): Promise<UploadResult | null> {
    setActionError(null)
    try {
      const result = await uploadClients(file, mode)
      await load()
      return result
    } catch (error) {
      handleError(error, setActionError)
      return null
    }
  }

  return { state, actionError, retry: load, add, remove, upload }
}
