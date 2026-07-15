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
import {
  base64urlToBytes,
  decodeRequestOptions,
  serializeAssertion,
} from '#/lib/auth/webauthn'
import type { PublicKeyRequestOptionsJSON } from '#/lib/auth/webauthn'

const ORG_KEY = 'catlico.orgId'

const isBrowser = typeof window !== 'undefined'

let accessToken: string | null = null

type TokenResponse = {
  access_token: string
  token_type: string
  // The normal login response omits these, but tolerate explicit `false` values
  // so each discriminant keys off the value, never mere key presence.
  mfa_required?: false
  password_reset_required?: false
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
type MfaChallenge = {
  mfa_required: true
  pending_token: string
  password_reset_required?: false
}

/**
 * The API's force-reset response — issued instead of tokens when the account
 * carries `must_change_password`. The user proved their password but must set a
 * new one first; `reset_token` is a single-use token for the reset page. No
 * session/cookie is issued.
 */
type PasswordResetRequired = {
  password_reset_required: true
  reset_token: string
  mfa_required?: false
}

/**
 * The outcome of a password login: the session is fully established (`ok`); the
 * account has MFA and the caller must complete a second step with the short-lived
 * `pendingToken`; or the account is flagged for a forced password reset and the
 * caller must bounce to the reset page with `resetToken`. Only `ok` issues a
 * session — the other two issue no tokens/cookie.
 */
export type LoginResult =
  | { status: 'ok' }
  | { status: 'mfa_required'; pendingToken: string }
  | { status: 'password_reset_required'; resetToken: string }

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
    .json<TokenResponse | MfaChallenge | PasswordResetRequired>()

  // Discriminate on the VALUE, not just the key's presence (a token response may
  // carry an explicit `false`). Force-reset is checked first: a flagged account
  // gets no session and must bounce to the reset page.
  if (body.password_reset_required === true) {
    return { status: 'password_reset_required', resetToken: body.reset_token }
  }
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

/**
 * Which second step a pending MFA token demands. When org-wide MFA enforcement
 * is on, a user without a second factor is handed an *enrollment* pending token
 * (forced to set one up before login completes) instead of the ordinary
 * *verify* pending token. The two login responses are shape-identical; the only
 * discriminator is the token's `type` claim.
 */
export type MfaPendingKind = 'mfa_enrollment' | 'mfa_pending'

/**
 * Decode a pending MFA token's `type` claim to route the second step. This is a
 * client-side hint only (the server re-validates every second-step call), so
 * robustness beats precision: any decode failure, or a missing/unknown type,
 * falls back to the verify path — ONLY an explicit `mfa_enrollment` takes the
 * forced-enrollment branch.
 */
export function mfaPendingKind(pendingToken: string): MfaPendingKind {
  try {
    const payload = pendingToken.split('.')[1]
    const json = new TextDecoder().decode(base64urlToBytes(payload))
    const type = (JSON.parse(json) as { type?: unknown }).type
    return type === 'mfa_enrollment' ? 'mfa_enrollment' : 'mfa_pending'
  } catch {
    return 'mfa_pending'
  }
}

/** The secret + otpauth URI the API returns to begin forced enrolment. */
export type MfaEnrollment = { secret: string; provisioning_uri: string }

/**
 * Begin forced MFA enrolment, driven by an `mfa_enrollment` pending token from
 * `login()`. Unauthenticated (the pending token in the body is the credential):
 * returns the shared `secret` and an `otpauth://` `provisioning_uri` for the
 * authenticator app. Throws HTTPError 401 on a bad/expired/wrong-type token, or
 * 409 if enrolment was already confirmed.
 */
export async function startMfaEnrollment(
  pendingToken: string,
): Promise<MfaEnrollment> {
  return api
    .post('auth/mfa/enrollment/enroll', {
      json: { pending_token: pendingToken },
      credentials: 'include',
    })
    .json<MfaEnrollment>()
}

/**
 * Confirm forced MFA enrolment with a TOTP code. On success the API issues
 * tokens + the refresh cookie exactly like a normal login AND returns the
 * one-time recovery codes, so we finish with the same bootstrap
 * (`completeSession`) and hand the recovery codes back for the caller to show
 * once. Throws HTTPError 400 on a wrong code (401 on a bad pending token).
 * `credentials: 'include'` so the refresh cookie lands.
 */
export async function confirmMfaEnrollment(
  pendingToken: string,
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const result = await api
    .post('auth/mfa/enrollment/confirm', {
      json: { pending_token: pendingToken, code },
      credentials: 'include',
    })
    .json<TokenResponse & { recovery_codes: string[] }>()

  await completeSession(result.access_token)
  return { recoveryCodes: result.recovery_codes }
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
