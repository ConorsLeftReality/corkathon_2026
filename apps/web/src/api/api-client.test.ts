import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { ApiError, createApiClient } from '#src/api/api-client.ts'

type Call = { path: string; init: RequestInit }

function client(response: Response | Error, cookies = '') {
  const calls: Call[] = []
  const request = createApiClient({
    fetch: (path, init) => {
      calls.push({ path, init })
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
    },
    readCookies: () => cookies,
  })
  return { request, calls }
}

const noteSchema = z.object({ id: z.number() })

function headersOf(call: Call | undefined): Headers {
  return new Headers(call?.init.headers)
}

describe('createApiClient', () => {
  it('returns the parsed body', async () => {
    const { request } = client(Response.json({ id: 1 }))
    expect(await request('/api/notes', noteSchema)).toEqual({ id: 1 })
  })

  it('sends the csrf cookie as a header on writes', async () => {
    const { request, calls } = client(
      Response.json({ id: 1 }),
      'theme=dark; csrf_access_token=abc123',
    )
    await request('/api/notes', noteSchema, { method: 'POST', body: { body: 'hi' } })
    expect(headersOf(calls[0]).get('X-CSRF-TOKEN')).toBe('abc123')
    expect(headersOf(calls[0]).get('Content-Type')).toBe('application/json')
    expect(calls[0]?.init.body).toBe('{"body":"hi"}')
  })

  it('leaves the csrf header off reads', async () => {
    const { request, calls } = client(Response.json({ id: 1 }), 'csrf_access_token=abc123')
    await request('/api/notes', noteSchema)
    expect(headersOf(calls[0]).has('X-CSRF-TOKEN')).toBe(false)
  })

  it('accepts an empty 204', async () => {
    const { request } = client(new Response(null, { status: 204 }))
    await request('/api/x', z.undefined(), { method: 'DELETE' })
  })

  it('turns a flask error into an ApiError with its code and fields', async () => {
    const body = { error: { code: 'validation_failed', message: 'Check.', fields: ['email'] } }
    const { request } = client(Response.json(body, { status: 422 }))
    const error = await request('/api/x', noteSchema).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'validation_failed', status: 422, fields: ['email'] })
  })

  it('reports a failed fetch as network_error', async () => {
    const { request } = client(new TypeError('failed to fetch'))
    const error = await request('/api/x', noteSchema).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'network_error', status: 0 })
  })

  it('reports a non json error page as bad_response', async () => {
    const { request } = client(new Response('<h1>502</h1>', { status: 502 }))
    const error = await request('/api/x', noteSchema).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'bad_response', status: 502 })
  })

  it('reports a body that breaks the schema as bad_response', async () => {
    const { request } = client(Response.json({ id: 'not a number' }))
    const error = await request('/api/x', noteSchema).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'bad_response', status: 200 })
  })
})
