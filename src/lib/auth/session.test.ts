import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** Minimal unsigned JWT — the client decodes payloads as hints only. */
const jwtWith = (payload: Record<string, unknown>) =>
  `x.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_')}.y`

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('login keeps the access token in memory, never localStorage', async () => {
  const access = jwtWith({ organisations: ['org-1'] })
  fetchMock.mockResolvedValueOnce(
    json({ access_token: access, token_type: 'bearer' }),
  )
  const session = await import('#/lib/auth/session')

  await session.login('admin@example.com', 'changeme')

  expect(session.getAccessToken()).toBe(access)
  expect(localStorage.getItem('catlico.accessToken')).toBeNull()
  expect(localStorage.getItem('catlico.refreshToken')).toBeNull()
  expect(localStorage.getItem('catlico.orgId')).toBe('org-1')
})

it('ensureSession silently refreshes when memory is empty', async () => {
  fetchMock.mockResolvedValueOnce(
    json({ access_token: 'fresh-token', token_type: 'bearer' }),
  )
  const session = await import('#/lib/auth/session')

  await expect(session.ensureSession()).resolves.toBe(true)

  expect(session.getAccessToken()).toBe('fresh-token')
  const request = fetchMock.mock.calls[0][0] as Request
  expect(request.url).toContain('auth/refresh')
  expect(request.method).toBe('POST')
  expect(request.headers.get('x-requested-with')).toBe('XMLHttpRequest')
})

it('ensureSession returns false when the refresh cookie is gone', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
  const session = await import('#/lib/auth/session')

  await expect(session.ensureSession()).resolves.toBe(false)
  expect(session.getAccessToken()).toBeNull()
})

it('ensureSession short-circuits when a token is already in memory', async () => {
  const session = await import('#/lib/auth/session')
  session.setAccessToken('cached')

  await expect(session.ensureSession()).resolves.toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('clearSession drops the in-memory token and the stored org', async () => {
  const session = await import('#/lib/auth/session')
  session.setAccessToken('t')
  localStorage.setItem('catlico.orgId', 'org-1')

  session.clearSession()

  expect(session.getAccessToken()).toBeNull()
  expect(localStorage.getItem('catlico.orgId')).toBeNull()
})
