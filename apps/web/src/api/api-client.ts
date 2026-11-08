import { z } from 'zod'

const errorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.string()).optional(),
  }),
})

const BAD_RESPONSE_MESSAGE = 'The server sent a response we could not read. Try again.'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fields: string[]

  constructor(code: string, message: string, status: number, fields: string[] = []) {
    super(message)
    this.code = code
    this.status = status
    this.fields = fields
  }
}

type ApiClientDeps = {
  fetch: (path: string, init: RequestInit) => Promise<Response>
  readCookies: () => string
}

type RequestOptions = {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function readCsrfToken(cookies: string): string | undefined {
  const pair = cookies.split('; ').find((cookie) => cookie.startsWith('csrf_access_token='))
  return pair?.slice('csrf_access_token='.length)
}

function buildInit(options: RequestOptions, cookies: string): RequestInit {
  const headers = new Headers()
  const csrfToken = readCsrfToken(cookies)
  if (options.method !== undefined && csrfToken !== undefined) {
    headers.set('X-CSRF-TOKEN', csrfToken)
  }
  if (options.body === undefined) return { method: options.method ?? 'GET', headers }
  // the browser writes the multipart boundary itself, so no content type here
  if (options.body instanceof FormData) {
    return { method: options.method ?? 'GET', headers, body: options.body }
  }
  headers.set('Content-Type', 'application/json')
  return { method: options.method ?? 'GET', headers, body: JSON.stringify(options.body) }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  // a proxy error page is html, and that has to end up as bad_response
  return response.json().catch((): unknown => null)
}

export function createApiClient({ fetch, readCookies }: ApiClientDeps) {
  return async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await fetch(path, buildInit(options, readCookies())).catch(() => {
      throw new ApiError(
        'network_error',
        'Could not reach the server. Check your connection and try again.',
        0,
      )
    })
    const payload = await readJson(response)

    if (!response.ok) {
      const parsed = errorEnvelope.safeParse(payload)
      if (!parsed.success) throw new ApiError('bad_response', BAD_RESPONSE_MESSAGE, response.status)
      const { code, message, fields } = parsed.data.error
      throw new ApiError(code, message, response.status, fields)
    }

    const parsed = schema.safeParse(payload)
    if (!parsed.success) throw new ApiError('bad_response', BAD_RESPONSE_MESSAGE, response.status)
    return parsed.data
  }
}

export const apiRequest = createApiClient({
  fetch: (path, init) => fetch(path, init),
  readCookies: () => document.cookie,
})
