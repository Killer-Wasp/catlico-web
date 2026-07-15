/**
 * Client-side auth session. The access token lives in module memory only —
 * never localStorage — so XSS cannot lift a durable credential. The refresh
 * token is an httpOnly cookie owned by the API (invisible to JS); a page load
 * re-establishes the session with one silent refresh (`ensureSession`).
 *
 * The server re-validates every request, so anything decoded here is a hint,
 * never a trust boundary.
 */
import { api, refreshAccessToken } from '#/lib/api/client'
import { decodeRequestOptions, serializeAssertion } from '#/lib/auth/webauthn'
import type { PublicKeyRequestOptionsJSON } from '#/lib/auth/webauthn'

const ORG_KEY = 'catlico.orgId'

const isBrowser = typeof window !== 'undefined'

let accessToken: string | null = null

type TokenResponse = {
  access_token: string
  token_type: string
  // The normal login response omits this, but tolerate an explicit `false` so
  // the MFA discriminant keys off the value, never mere key presence.
  mfa_required?: false
}

export function getAccessToken(): string | null {
  return accessToken
}

/** Replace just the access token (used by the refresh flow in the api client). */
export function setAccessToken(token: string): void {
  accessToken = token
}

export function getActiveOrgId(): string | null {
  return isBrowser ? localStorage.getItem(ORG_KEY) : null
}

export function clearSession(): void {
  accessToken = null
  if (isBrowser) localStorage.removeItem(ORG_KEY)
}

/**
 * True once a session is usable: an access token already in memory, or an
 * httpOnly refresh cookie that a silent refresh can turn into one. Route
 * guards await this before rendering (concurrent callers share one refresh —
 * the api client de-dupes).
 */
export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true
  return refreshAccessToken()
}

/** Decode a JWT payload without verifying it (a client-side hint only). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

/** The `organisations` claim from an access token (empty if absent). */
function orgsFromToken(token: string): string[] {
  const orgs = decodeJwt(token)?.organisations
  return Array.isArray(orgs) ? (orgs as string[]) : []
}

export function getSessionOrganisationIds(): string[] {
  const access = getAccessToken()
  return access ? orgsFromToken(access) : []
}

/**
 * Store an issued access token and resolve an active organisation: prefer the
 * membership baked into the token; fall back to the org list (superadmins carry
 * no membership but may administer orgs). Throws when no org is available. The
 * single place the post-login bootstrap lives, shared by the direct-login and
 * MFA-verify paths (all of which receive the same `{access_token}` bundle plus
 * the server-set refresh cookie).
 */
async function completeSession(token: string): Promise<void> {
  setAccessToken(token)

  let orgId = orgsFromToken(token)[0]
  if (!orgId) {
    const orgs = await api.get('organisations/').json<Array<{ id: string }>>()
    orgId = orgs[0]?.id
  }
  if (!orgId) {
    clearSession()
    throw new Error('No organisation is available for this account.')
  }
  localStorage.setItem(ORG_KEY, orgId)
}

/** The API's second-factor challenge — issued instead of tokens when MFA is on. */
type MfaChallenge = { mfa_required: true; pending_token: string }

/**
 * The outcome of a password login: either the session is fully established
 * (`ok`), or the account has MFA and the caller must complete a second step
 * with the short-lived `pendingToken`. No tokens/cookie are issued in the
 * `mfa_required` case — the second-step endpoints issue them.
 */
export type LoginResult =
  | { status: 'ok' }
  | { status: 'mfa_required'; pendingToken: string }

/**
 * Exchange credentials for a session. On the normal path the API returns a
 * token bundle (+ refresh cookie) and we complete the session as before. When
 * MFA is enabled and confirmed the API instead returns
 * `{mfa_required: true, pending_token}` with NO tokens/cookie; we surface that
 * so the caller can drive the second step (`verifyMfaCode` / `verifyPasskey`).
 * Throws on bad credentials (HTTPError 401). `credentials: 'include'` so the
 * refresh cookie lands on the token path.
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const body = await api
    .post('auth/login', { json: { email, password }, credentials: 'include' })
    .json<TokenResponse | MfaChallenge>()

  // Discriminate on the VALUE, not just the key's presence: a token response
  // that ever carried `mfa_required: false` must still establish the session
  // rather than misroute into the MFA step.
  if (body.mfa_required === true) {
    return { status: 'mfa_required', pendingToken: body.pending_token }
  }

  await completeSession(body.access_token)
  return { status: 'ok' }
}

/**
 * Complete an MFA login with a TOTP or recovery code, driven by the
 * `pendingToken` from `login()`. On success the API issues tokens + the refresh
 * cookie exactly like a normal login, so we finish with the same bootstrap.
 * Throws HTTPError 401 on a wrong/expired code (generic — no oracle).
 */
export async function verifyMfaCode(
  pendingToken: string,
  code: string,
): Promise<void> {
  const token = await api
    .post('auth/mfa/verify', {
      json: { pending_token: pendingToken, code },
      credentials: 'include',
    })
    .json<TokenResponse>()

  await completeSession(token.access_token)
}

/** Thrown when the browser's passkey prompt is dismissed or unavailable. */
export class PasskeyCancelledError extends Error {
  constructor(message = 'Passkey sign-in was cancelled.') {
    super(message)
    this.name = 'PasskeyCancelledError'
  }
}

/**
 * Complete an MFA login with a passkey, driven by the `pendingToken` from
 * `login()`: fetch the challenge options, prompt the authenticator, then post
 * the serialized assertion. On success the API issues tokens + the refresh
 * cookie, so we finish with the same bootstrap as a normal login. A dismissed
 * or unavailable prompt raises `PasskeyCancelledError`; a server rejection
 * surfaces as HTTPError 401.
 */
export async function verifyPasskey(pendingToken: string): Promise<void> {
  const options = await api
    .post('auth/mfa/passkey/auth/options', {
      json: { pending_token: pendingToken },
      credentials: 'include',
    })
    .json<PublicKeyRequestOptionsJSON>()

  // Decode OUTSIDE the try: a malformed-options decode is a real server bug and
  // must propagate as such, not be masked as a user cancellation.
  const publicKey = decodeRequestOptions(options)
  let assertion: Credential | null
  try {
    assertion = await navigator.credentials.get({ publicKey })
  } catch {
    // A dismissed prompt, no matching authenticator, or an aborted ceremony all
    // throw here (client-side) — treat them uniformly as a cancellation.
    throw new PasskeyCancelledError()
  }
  if (!assertion) throw new PasskeyCancelledError()

  const token = await api
    .post('auth/mfa/passkey/auth/verify', {
      json: {
        pending_token: pendingToken,
        credential: serializeAssertion(assertion as PublicKeyCredential),
      },
      credentials: 'include',
    })
    .json<TokenResponse>()

  await completeSession(token.access_token)
}

/**
 * Request a password reset email. Unauthenticated; resolves regardless of
 * whether the email is registered (the API always returns the same response),
 * so callers must not infer account existence from success.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('auth/password/forgot', { json: { email } })
}

/**
 * Complete a password reset with a token from the emailed link. Unauthenticated;
 * throws HTTPError 400 on an invalid/expired token or a password that fails the
 * server's policy.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post('auth/password/reset', {
    json: { token, new_password: newPassword },
  })
}

export function logout(): void {
  // Fire-and-forget server-side revocation: JS cannot delete the httpOnly
  // cookie itself. keepalive lets the request survive the page navigation
  // that follows in the Header's logout handler.
  void api
    .post('auth/logout', {
      credentials: 'include',
      keepalive: true,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    .catch(() => {})
  clearSession()
}
