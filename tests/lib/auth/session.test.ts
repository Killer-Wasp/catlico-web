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

it('login returns an ok result on the normal token response', async () => {
  fetchMock.mockResolvedValueOnce(
    json({ access_token: jwtWith({ organisations: ['org-1'] }), token_type: 'bearer' }),
  )
  const session = await import('#/lib/auth/session')

  await expect(session.login('a@b.com', 'pw')).resolves.toEqual({
    status: 'ok',
  })
})

it('login surfaces mfa_required with the pending token and issues NO session', async () => {
  fetchMock.mockResolvedValueOnce(
    json({ mfa_required: true, pending_token: 'pending-123' }),
  )
  const session = await import('#/lib/auth/session')

  const result = await session.login('admin@example.com', 'changeme')

  expect(result).toEqual({ status: 'mfa_required', pendingToken: 'pending-123' })
  // No token stored, no org resolved, and no second (org list) call made.
  expect(session.getAccessToken()).toBeNull()
  expect(localStorage.getItem('catlico.orgId')).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('verifyMfaCode posts the pending token + code and completes the session', async () => {
  const access = jwtWith({ organisations: ['org-9'] })
  // Capture the outgoing body at send-time — ky consumes the request stream, so
  // it can't be re-read from the recorded Request afterwards.
  let sentUrl = ''
  let sentMethod = ''
  let sentBody: unknown
  fetchMock.mockImplementationOnce(async (req: Request) => {
    sentUrl = req.url
    sentMethod = req.method
    sentBody = await req.json()
    return json({ access_token: access, token_type: 'bearer' })
  })
  const session = await import('#/lib/auth/session')

  await session.verifyMfaCode('pending-123', '123456')

  expect(sentUrl).toContain('auth/mfa/verify')
  expect(sentMethod).toBe('POST')
  expect(sentBody).toEqual({ pending_token: 'pending-123', code: '123456' })
  // Completed exactly like a normal login: token in memory, org resolved.
  expect(session.getAccessToken()).toBe(access)
  expect(localStorage.getItem('catlico.orgId')).toBe('org-9')
})

it('verifyPasskey requests options, calls navigator.credentials.get with decoded options, posts the serialized assertion, and completes login', async () => {
  const { bytesToBase64url } = await import('#/lib/auth/webauthn')
  const challenge = new Uint8Array([5, 6, 7, 8])
  const credId = new Uint8Array([9, 9, 9])
  const access = jwtWith({ organisations: ['org-2'] })

  // 1) options 2) verify (returns the token bundle). Capture bodies at
  // send-time — ky consumes each request stream.
  const sent: Array<{ url: string; body: unknown }> = []
  fetchMock.mockImplementationOnce(async (req: Request) => {
    sent.push({ url: req.url, body: await req.json() })
    return json({
      challenge: bytesToBase64url(challenge.buffer),
      allowCredentials: [
        { id: bytesToBase64url(credId.buffer), type: 'public-key' },
      ],
      userVerification: 'preferred',
    })
  })
  fetchMock.mockImplementationOnce(async (req: Request) => {
    sent.push({ url: req.url, body: await req.json() })
    return json({ access_token: access, token_type: 'bearer' })
  })

  // Fake authenticator assertion.
  const fakeAssertion = {
    id: 'cred-x',
    rawId: new Uint8Array([1, 2]).buffer,
    type: 'public-key',
    response: {
      authenticatorData: new Uint8Array([10]).buffer,
      clientDataJSON: new Uint8Array([20]).buffer,
      signature: new Uint8Array([30]).buffer,
      userHandle: null,
    },
  }
  const getMock = vi.fn().mockResolvedValue(fakeAssertion)
  vi.stubGlobal('navigator', { credentials: { get: getMock } })

  const session = await import('#/lib/auth/session')
  await session.verifyPasskey('pending-abc')

  // navigator.credentials.get called with DECODED options.
  const publicKey = getMock.mock.calls[0][0].publicKey
  expect(new Uint8Array(publicKey.challenge)).toEqual(challenge)
  expect(new Uint8Array(publicKey.allowCredentials[0].id)).toEqual(credId)

  // options request
  expect(sent[0].url).toContain('auth/mfa/passkey/auth/options')
  expect(sent[0].body).toEqual({ pending_token: 'pending-abc' })

  // verify request carries the serialized assertion (base64url).
  expect(sent[1].url).toContain('auth/mfa/passkey/auth/verify')
  expect(sent[1].body).toEqual({
    pending_token: 'pending-abc',
    credential: {
      id: 'cred-x',
      rawId: bytesToBase64url(fakeAssertion.rawId),
      type: 'public-key',
      response: {
        authenticatorData: bytesToBase64url(new Uint8Array([10]).buffer),
        clientDataJSON: bytesToBase64url(new Uint8Array([20]).buffer),
        signature: bytesToBase64url(new Uint8Array([30]).buffer),
        userHandle: null,
      },
    },
  })

  expect(session.getAccessToken()).toBe(access)
  expect(localStorage.getItem('catlico.orgId')).toBe('org-2')
})

it('verifyPasskey throws PasskeyCancelledError when the user dismisses the prompt', async () => {
  fetchMock.mockResolvedValueOnce(
    json({ challenge: btoa('c').replace(/=+$/, ''), allowCredentials: [] }),
  )
  const getMock = vi.fn().mockRejectedValue(
    new DOMException('cancelled', 'NotAllowedError'),
  )
  vi.stubGlobal('navigator', { credentials: { get: getMock } })

  const session = await import('#/lib/auth/session')
  await expect(session.verifyPasskey('pending-abc')).rejects.toBeInstanceOf(
    session.PasskeyCancelledError,
  )
  // No token issued, no verify POST made.
  expect(session.getAccessToken()).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('mfaPendingKind decodes an mfa_enrollment token', async () => {
  const session = await import('#/lib/auth/session')
  expect(session.mfaPendingKind(jwtWith({ type: 'mfa_enrollment' }))).toBe(
    'mfa_enrollment',
  )
})

it('mfaPendingKind decodes an mfa_pending token', async () => {
  const session = await import('#/lib/auth/session')
  expect(session.mfaPendingKind(jwtWith({ type: 'mfa_pending' }))).toBe(
    'mfa_pending',
  )
})

it('mfaPendingKind falls back to the verify path on a missing/unknown type', async () => {
  const session = await import('#/lib/auth/session')
  // Missing type, unknown type, and a malformed (non-JWT) token all route to
  // the verify path — only an explicit mfa_enrollment takes the new branch.
  expect(session.mfaPendingKind(jwtWith({ sub: 'user-1' }))).toBe('mfa_pending')
  expect(session.mfaPendingKind(jwtWith({ type: 'something_else' }))).toBe(
    'mfa_pending',
  )
  expect(session.mfaPendingKind('not-a-jwt')).toBe('mfa_pending')
  expect(session.mfaPendingKind('')).toBe('mfa_pending')
})

it('startMfaEnrollment posts the pending token and returns the secret + otpauth URI', async () => {
  let sentUrl = ''
  let sentMethod = ''
  let sentBody: unknown
  fetchMock.mockImplementationOnce(async (req: Request) => {
    sentUrl = req.url
    sentMethod = req.method
    sentBody = await req.json()
    return json({ secret: 'S3CR3T', provisioning_uri: 'otpauth://totp/x' })
  })
  const session = await import('#/lib/auth/session')

  const result = await session.startMfaEnrollment('pending-enroll')

  expect(sentUrl).toContain('auth/mfa/enrollment/enroll')
  expect(sentMethod).toBe('POST')
  expect(sentBody).toEqual({ pending_token: 'pending-enroll' })
  expect(result).toEqual({
    secret: 'S3CR3T',
    provisioning_uri: 'otpauth://totp/x',
  })
  // Unauthenticated: no session established by enroll.
  expect(session.getAccessToken()).toBeNull()
})

it('confirmMfaEnrollment posts token + code, completes the session, and returns the recovery codes', async () => {
  const access = jwtWith({ organisations: ['org-7'] })
  let sentUrl = ''
  let sentMethod = ''
  let sentBody: unknown
  fetchMock.mockImplementationOnce(async (req: Request) => {
    sentUrl = req.url
    sentMethod = req.method
    sentBody = await req.json()
    return json({
      access_token: access,
      token_type: 'bearer',
      recovery_codes: ['aaa-111', 'bbb-222'],
    })
  })
  const session = await import('#/lib/auth/session')

  const result = await session.confirmMfaEnrollment('pending-enroll', '123456')

  expect(sentUrl).toContain('auth/mfa/enrollment/confirm')
  expect(sentMethod).toBe('POST')
  expect(sentBody).toEqual({ pending_token: 'pending-enroll', code: '123456' })
  // Recovery codes surfaced for the one-time display.
  expect(result).toEqual({ recoveryCodes: ['aaa-111', 'bbb-222'] })
  // Completed exactly like a normal login: token in memory, org resolved.
  expect(session.getAccessToken()).toBe(access)
  expect(localStorage.getItem('catlico.orgId')).toBe('org-7')
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
