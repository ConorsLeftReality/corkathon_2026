import { useCallback, useRef, useState } from 'react'
import { ApiError } from '#src/api/api-client.ts'
import { askRadar } from '#src/features/radar/radar-api.ts'
import type { RadarAnswer, RadarMode, RadarSnapshot } from '#src/features/radar/radar-api.ts'

export type RadarState =
  | { status: 'idle' }
  | { status: 'loading'; question: string }
  | { status: 'answer'; question: string; response: RadarAnswer }
  | {
      status: 'reply'
      question: string
      kind: 'clarify' | 'refuse'
      message: string
      snapshot: RadarSnapshot
    }
  | { status: 'error'; question: string; code: string; message: string }

type Ask = { question: string; preset?: string }

export function useRadar(mode: RadarMode, onSessionLost: () => void) {
  const [state, setState] = useState<RadarState>({ status: 'idle' })
  const latest = useRef(0)

  const reset = useCallback(() => {
    latest.current += 1
    setState({ status: 'idle' })
  }, [])

  const ask = useCallback(
    async ({ question, preset }: Ask) => {
      latest.current += 1
      const ticket = latest.current
      setState({ status: 'loading', question })
      try {
        const response = await askRadar(
          preset === undefined ? { mode, question } : { mode, preset },
        )
        if (ticket !== latest.current) return
        if (response.kind === 'answer') setState({ status: 'answer', question, response })
        else setState({ status: 'reply', question, ...response })
      } catch (error) {
        if (!(error instanceof ApiError)) throw error
        if (ticket !== latest.current) return
        if (error.status === 401) onSessionLost()
        else setState({ status: 'error', question, code: error.code, message: error.message })
      }
    },
    [mode, onSessionLost],
  )

  return { state, ask, reset }
}
