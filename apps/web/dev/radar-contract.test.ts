import { describe, expect, it } from 'bun:test'
import { runContractChecks } from './radar-contract.ts'
import type { ContractClient, Session } from './radar-contract.ts'
import { createRadarMock } from './radar-mock.ts'

// a fake api built from the mock, one client list per signed in session like the real one
function fakeApi(
  options: { shareLists?: boolean; skipAuth?: boolean; breakSnapshot?: boolean } = {},
) {
  const shared = createRadarMock()
  const perSession = new Map<string, ReturnType<typeof createRadarMock>>()
  let next = 0

  const client: ContractClient = {
    signUp: () => {
      next += 1
      const session: Session = { cookie: `s${next}`, csrf: 'token' }
      perSession.set(session.cookie, options.shareLists ? shared : createRadarMock())
      return Promise.resolve(session)
    },
    send: (method, path, body, session) => {
      if (!session && !options.skipAuth) {
        return Promise.resolve({
          status: 401,
          body: { error: { code: 'unauthorized', message: 'Sign in.' } },
        })
      }
      if (options.breakSnapshot && path === '/api/radar/snapshot') {
        return Promise.resolve({ status: 200, body: { newest_reg_date: '06/11/2026' } })
      }
      const mock = (session && perSession.get(session.cookie)) ?? shared
      return Promise.resolve(mock.handle(method, path, body) ?? { status: 404, body: null })
    },
  }
  return client
}

describe('runContractChecks', () => {
  it('passes an api that meets the contract', async () => {
    const results = await runContractChecks(fakeApi())
    expect(results.filter((result) => result.outcome === 'fail')).toEqual([])
  })

  it('names the field that breaks the contract', async () => {
    const results = await runContractChecks(fakeApi({ breakSnapshot: true }))
    const snapshot = results.find((result) => result.name.startsWith('GET /api/radar/snapshot'))
    expect(snapshot?.outcome).toBe('fail')
    expect(snapshot?.detail).toContain('newest_reg_date')
  })

  it('fails when one user can see another user client list', async () => {
    const results = await runContractChecks(fakeApi({ shareLists: true }))
    const isolation = results.find((result) => result.name.includes('another user'))
    expect(isolation?.outcome).toBe('fail')
  })

  it('fails when the client list is readable without signing in', async () => {
    const results = await runContractChecks(fakeApi({ skipAuth: true }))
    const auth = results.find((result) => result.name.includes('without a session'))
    expect(auth?.outcome).toBe('fail')
  })
})
