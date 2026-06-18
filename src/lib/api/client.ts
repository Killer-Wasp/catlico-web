/**
 * The single network seam for the whole app. `api` is a configured `ky`
 * instance — every query and mutation goes through it, so the base URL, auth
 * headers and the 401-refresh flow are defined in exactly one place.
 *
 *   const page = await api.get('alerts/').json<Page<Alert>>()
 *
 * Non-2xx responses reject with ky's `HTTPError` (`error.response.status`);
 * branch on it with `isHTTPError` from `ky`.
 *
 * Auth: the current access token is attached as `Authorization: Bearer`, and
 * the active org as `X-Organisation-Id` (org-scoped routes require it). On a
 * 401 we transparently refresh the access token once and retry.
 */
import ky from 'ky'

import {
  clearSession,
  getAccessToken,
  getActiveOrgId,
  getRefreshToken,
  setAccessToken,
} from '#/lib/auth/session'

/** Base URL for the API. Override per-environment via `VITE_API_BASE_URL`. */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * ky resolves a relative `input` (e.g. `'alerts/'`) against `baseUrl`, so the
 * base must be absolute and end in a slash (a trailing slash keeps URL
 * resolution from dropping the last path segment). When `API_BASE` is relative
 * (the same-origin default), resolve it against the current origin first.
 */
const absolute = /^https?:\/\//.test(API_BASE)
  ? API_BASE
  : typeof window !== 'undefined'
    ? new URL(API_BASE, window.location.origin).toString()
    : API_BASE
const BASE_URL = absolute.endsWith('/') ? absolute : `${absolute}/`

// De-dupe concurrent refreshes: many parallel 401s share one refresh call.
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return false

  refreshPromise ??= (async () => {
    try {
      const data = await ky
        .post(`${BASE_URL}auth/refresh`, {
          json: { refresh_token },
          retry: 0,
        })
        .json<{ access_token: string }>()
      setAccessToken(data.access_token)
      return true
    } catch {
      return false
    }
  })()

  const ok = await refreshPromise
  refreshPromise = null
  return ok
}

/**
 * The app's HTTP client. A `beforeRequest` hook attaches auth, and an
 * `afterResponse` hook refreshes the access token and forces a single retry on
 * a 401 (`retryCount === 0` guards against looping). Automatic retries are
 * disabled — react-query owns the retry policy — but `limit: 1` leaves room for
 * the one forced refresh-retry.
 */
export const api = ky.create({
  baseUrl: BASE_URL,
  retry: { limit: 1, methods: [], statusCodes: [] },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getAccessToken()
        const orgId = getActiveOrgId()
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
        if (orgId) request.headers.set('X-Organisation-Id', orgId)
      },
    ],
    afterResponse: [
      async ({ request, response, retryCount }) => {
        if (response.status !== 401 || retryCount > 0 || !getRefreshToken()) {
          return
        }
        if (await refreshAccessToken()) {
          const headers = new Headers(request.headers)
          headers.set('Authorization', `Bearer ${getAccessToken()}`)
          return ky.retry({ request: new Request(request, { headers }) })
        }
        clearSession()
      },
    ],
  },
})
