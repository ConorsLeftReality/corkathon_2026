import { z } from 'zod'

const DEFAULT_TARGET = '/app'
const savedLocation = z.object({ from: z.string() })

export function redirectTarget(state: unknown): string {
  const parsed = savedLocation.safeParse(state)
  if (!parsed.success) return DEFAULT_TARGET
  const { from } = parsed.data
  // browsers read //host and /\host as another site
  const internal = from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\')
  return internal ? from : DEFAULT_TARGET
}
