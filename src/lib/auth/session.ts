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

const ORG_KEY = 'catlico.orgId'

const isBrowser = typeof window !== 'undefined'

let accessToken: string | null = null

type TokenResponse = {
  access_token: string
  token_type: string
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
 * Exchange credentials for a session, then resolve an active organisation:
 * prefer the membership baked into the access token; fall back to the org list
 * (superadmins carry no membership but may administer orgs). Throws on bad
 * credentials (HTTPError 401) or when no org is available. The API sets the
 * refresh cookie on this response, hence `credentials: 'include'`.
 */
export async function login(email: string, password: string): Promise<void> {
  const token = await api
    .post('auth/login', { json: { email, password }, credentials: 'include' })
    .json<TokenResponse>()

  setAccessToken(token.access_token)

  let orgId = orgsFromToken(token.access_token)[0]
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
