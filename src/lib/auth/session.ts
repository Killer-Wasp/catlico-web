/**
 * Client-side auth session: token storage + login/logout + active-org
 * resolution. Tokens live in localStorage (browser only — every getter is a
 * no-op during SSR, which is what keeps protected routes from rendering on the
 * server; see the `_app` route guard).
 *
 * The server re-validates every request, so anything decoded here is a hint,
 * never a trust boundary.
 */
import { api } from '#/lib/api/client'

const ACCESS_KEY = 'catlico.accessToken'
const REFRESH_KEY = 'catlico.refreshToken'
const ORG_KEY = 'catlico.orgId'

const isBrowser = typeof window !== 'undefined'

type TokenResponse = {
  access_token: string
  token_type: string
  refresh_token?: string
}

export function getAccessToken(): string | null {
  return isBrowser ? localStorage.getItem(ACCESS_KEY) : null
}

export function getRefreshToken(): string | null {
  return isBrowser ? localStorage.getItem(REFRESH_KEY) : null
}

export function getActiveOrgId(): string | null {
  return isBrowser ? localStorage.getItem(ORG_KEY) : null
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

/** True only when the token carries an `exp` that has already passed. An
 *  undecodable/exp-less token is treated as not-expired (let the server rule). */
function isExpired(token: string): boolean {
  const exp = decodeJwt(token)?.exp
  return typeof exp === 'number' && exp * 1000 <= Date.now()
}

/**
 * Authenticated when a usable token remains: a still-valid refresh token (the
 * access token can be re-minted) or a still-valid access token. Both expired or
 * absent ⇒ not authenticated, so the route guard sends the user to /login.
 */
export function isAuthenticated(): boolean {
  const refresh = getRefreshToken()
  if (refresh && !isExpired(refresh)) return true
  const access = getAccessToken()
  return access !== null && !isExpired(access)
}

/** Replace just the access token (used by the refresh flow in the api client). */
export function setAccessToken(token: string): void {
  if (isBrowser) localStorage.setItem(ACCESS_KEY, token)
}

export function clearSession(): void {
  if (!isBrowser) return
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(ORG_KEY)
}

/** The `organisations` claim from an access token (empty if absent). */
function orgsFromToken(accessToken: string): string[] {
  const orgs = decodeJwt(accessToken)?.organisations
  return Array.isArray(orgs) ? (orgs as string[]) : []
}

/**
 * Exchange credentials for tokens, then resolve an active organisation:
 * prefer the membership baked into the access token; fall back to the org list
 * (superadmins carry no membership but may administer orgs). Throws on bad
 * credentials (HTTPError 401) or when no org is available.
 */
export async function login(email: string, password: string): Promise<void> {
  const token = await api
    .post('auth/login', { json: { email, password } })
    .json<TokenResponse>()

  localStorage.setItem(ACCESS_KEY, token.access_token)
  if (token.refresh_token) localStorage.setItem(REFRESH_KEY, token.refresh_token)

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

export function logout(): void {
  clearSession()
}
