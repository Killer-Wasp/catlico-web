/**
 * Live notification-bell updates. Opens a WebSocket to the API's activity
 * feed and invalidates the notifications query whenever an activity event
 * arrives, so the bell updates instantly instead of waiting on the 60s poll
 * (kept as a fallback in `notificationsQueryOptions`).
 *
 * Auth: WebSocket has no header API, so the access token and active org ride
 * along as query params. The token is re-read fresh on every (re)connect —
 * it rotates on refresh, so it deliberately does NOT sit in the effect's
 * dependency array (that would cause reconnect storms on every refresh).
 *
 * Message contract (server-defined, not negotiable here):
 *   - Activity events: JSON text `{"type":"event","event":{...}}`.
 *   - Keepalive frames: the plain-text strings "ping" / "pong" (not JSON) —
 *     the server pings when idle; we reply "pong". `JSON.parse` throws on
 *     these, so non-JSON frames are simply ignored.
 *   - Auth failure closes the socket with code 1008 (handled like any other
 *     close: backoff and retry — a later reconnect may succeed once the
 *     token/org state is valid again).
 */
import { notificationKeys } from '#/components/Header/notificationsQueries'
import { API_BASE } from '#/lib/api/client'
import { getAccessToken, getActiveOrgId } from '#/lib/auth/session'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

/**
 * Mirrors the base-URL resolution in `#/lib/api/client`: a relative
 * `API_BASE` (the same-origin default) resolves against the current origin,
 * then the scheme is swapped for its WebSocket equivalent.
 */
function buildSocketUrl(token: string, orgId: string): string {
  const absolute = /^https?:\/\//.test(API_BASE)
    ? API_BASE
    : new URL(API_BASE, window.location.origin).toString()
  const base = absolute.endsWith('/') ? absolute : `${absolute}/`

  const url = new URL('activity', base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', token)
  url.searchParams.set('organisation_id', orgId)
  return url.toString()
}

function isActivityEvent(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'event'
  )
}

/**
 * Connects only while both an access token and an active org are present —
 * i.e. while the user is logged in (mirrors `Header`'s mount lifetime inside
 * the authenticated `AppLayout`). Reconnects on close/error with capped
 * exponential backoff, reset on a successful open. Never reconnects after
 * unmount, and tolerates React StrictMode's mount → unmount → remount cycle
 * without leaking sockets (refs, not state, track the live connection).
 */
export function useNotificationSocket(): void {
  const queryClient = useQueryClient()
  const loggedIn = getAccessToken() !== null
  const orgId = getActiveOrgId()

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const unmountedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return
    }
    if (!loggedIn || !orgId) {
      return
    }

    unmountedRef.current = false
    backoffRef.current = INITIAL_BACKOFF_MS

    connect(queryClient, wsRef, timerRef, backoffRef, unmountedRef)

    return () => {
      unmountedRef.current = true
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      wsRef.current?.close()
      wsRef.current = null
    }
    // Deliberately not depending on the raw token: it rotates on refresh, and
    // `connect` always re-reads it fresh, so keying on it would just cause
    // reconnect storms. `loggedIn` (a boolean) is the stable proxy for it.
  }, [loggedIn, orgId, queryClient])
}

function connect(
  queryClient: QueryClient,
  wsRef: RefObject<WebSocket | null>,
  timerRef: RefObject<ReturnType<typeof setTimeout> | null>,
  backoffRef: RefObject<number>,
  unmountedRef: RefObject<boolean>,
): void {
  if (unmountedRef.current) return

  const token = getAccessToken()
  const orgId = getActiveOrgId()
  if (!token || !orgId) return

  const ws = new WebSocket(buildSocketUrl(token, orgId))
  wsRef.current = ws

  ws.onopen = () => {
    backoffRef.current = INITIAL_BACKOFF_MS
  }

  ws.onmessage = (ev: MessageEvent) => {
    if (ev.data === 'ping') {
      ws.send('pong')
      return
    }
    try {
      const message: unknown = JSON.parse(ev.data as string)
      if (isActivityEvent(message)) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      }
    } catch {
      // Non-JSON keepalive frame (or otherwise malformed) — ignore.
    }
  }

  ws.onclose = () => {
    if (unmountedRef.current) return
    const delay = backoffRef.current
    backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
    timerRef.current = setTimeout(
      () => connect(queryClient, wsRef, timerRef, backoffRef, unmountedRef),
      delay,
    )
  }

  ws.onerror = () => {
    ws.close()
  }
}
