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
 * Org switching: `setActiveOrganisation` writes localStorage but does not
 * remount the header, so the effect can't see the change through its deps.
 * It instead dispatches a same-tab `catlico:org-changed` event, which this
 * hook listens for and uses to tear down the socket and reconnect against the
 * fresh org (the `storage` event only fires in OTHER tabs, never this one).
 *
 * Message contract (server-defined, not negotiable here):
 *   - Activity events: JSON text `{"type":"event","event":{...}}` — org-wide
 *     activity; invalidates the notifications query so it refetches.
 *   - Per-user notifications: JSON text
 *     `{"type":"notification","notification":{...}}` — the actual pushed
 *     notification object; applied to the cache directly (prepend + dedup by
 *     id) so the bell updates without a refetch. Idempotent: the server may
 *     re-send on a drain retry, so a duplicate id is a no-op.
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
import type { UserNotification } from '#/components/Header/notificationsQueries'
import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

export const ORG_CHANGED_EVENT = 'catlico:org-changed'

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

/** `{"type":"notification","notification": <UserNotification>}` */
type NotificationMessage = {
  type: 'notification'
  notification: UserNotification
}

function isNotificationMessage(
  message: unknown,
): message is NotificationMessage {
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { type?: unknown }).type !== 'notification'
  ) {
    return false
  }
  const notification = (message as { notification?: unknown }).notification
  return (
    typeof notification === 'object' &&
    notification !== null &&
    typeof (notification as { id?: unknown }).id === 'string'
  )
}

/** Shared mutable connection state, threaded through `connect`/`teardown`. */
type SocketRefs = {
  ws: RefObject<WebSocket | null>
  timer: RefObject<ReturnType<typeof setTimeout> | null>
  backoff: RefObject<number>
  unmounted: RefObject<boolean>
}

/**
 * Connects only while both an access token and an active org are present —
 * i.e. while the user is logged in (mirrors `Header`'s mount lifetime inside
 * the authenticated `AppLayout`). Reconnects on close/error with capped
 * exponential backoff, reset on a successful open. Never reconnects after
 * unmount, and tolerates React StrictMode's mount → unmount → remount cycle
 * without leaking sockets: every socket-scoped handler is guarded by an
 * identity check (`ws === refs.ws.current`), so a superseded socket's late,
 * asynchronous `close` can neither schedule a reconnect nor orphan the live
 * socket.
 */
export function useNotificationSocket(): void {
  const queryClient = useQueryClient()
  const loggedIn = getAccessToken() !== null
  const orgId = getActiveOrgId()

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const unmountedRef = useRef(false)
  const refs: SocketRefs = {
    ws: wsRef,
    timer: timerRef,
    backoff: backoffRef,
    unmounted: unmountedRef,
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return
    }
    if (!loggedIn || !orgId) {
      return
    }

    unmountedRef.current = false
    backoffRef.current = INITIAL_BACKOFF_MS

    connect(queryClient, refs)

    // Org switches don't remount the header, so the effect can't see them via
    // deps — reconnect against the fresh org on the same-tab signal instead.
    const onOrgChanged = () => {
      if (unmountedRef.current) return
      teardown(refs)
      if (getAccessToken() === null || getActiveOrgId() === null) {
        // Logged out (or org cleared): dropped the socket, don't reconnect.
        return
      }
      backoffRef.current = INITIAL_BACKOFF_MS
      connect(queryClient, refs)
    }
    window.addEventListener(ORG_CHANGED_EVENT, onOrgChanged)

    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, onOrgChanged)
      unmountedRef.current = true
      teardown(refs)
    }
    // Deliberately not depending on the raw token: it rotates on refresh, and
    // `connect` always re-reads it fresh, so keying on it would just cause
    // reconnect storms. `loggedIn` (a boolean) is the stable proxy for it.
    // (`refs` is intentionally excluded — its members are stable useRef
    // containers, so it never needs to re-trigger the effect.)
  }, [loggedIn, orgId, queryClient])
}

/**
 * Close the live socket and cancel any pending reconnect, without arming a
 * new one. The closed socket's late `close` event is a no-op because it is no
 * longer `refs.ws.current` (see the identity guards in `connect`).
 */
function teardown(refs: SocketRefs): void {
  if (refs.timer.current !== null) {
    clearTimeout(refs.timer.current)
    refs.timer.current = null
  }
  const ws = refs.ws.current
  refs.ws.current = null
  ws?.close()
}

function connect(queryClient: QueryClient, refs: SocketRefs): void {
  if (refs.unmounted.current) return

  const token = getAccessToken()
  const orgId = getActiveOrgId()
  if (!token || !orgId) return

  const ws = new WebSocket(buildSocketUrl(token, orgId))
  refs.ws.current = ws

  ws.onopen = () => {
    // A late open from a superseded socket must not reset the live backoff.
    if (ws !== refs.ws.current) return
    refs.backoff.current = INITIAL_BACKOFF_MS
  }

  ws.onmessage = (ev: MessageEvent) => {
    // A superseded-but-not-yet-closed socket must not drive invalidations.
    if (ws !== refs.ws.current) return
    if (ev.data === 'ping') {
      ws.send('pong')
      return
    }
    try {
      const message: unknown = JSON.parse(ev.data as string)
      if (isNotificationMessage(message)) {
        // Apply the pushed notification straight to the cache — no refetch.
        // Prepend (newest-first, matching the server's `created_at desc`) and
        // dedup by id so a re-sent drain retry is a no-op.
        const incoming = message.notification
        const list =
          queryClient.getQueryData<UserNotification[]>(
            notificationKeys.list(),
          ) ?? []
        // Dedup by id so a re-sent drain retry is a no-op.
        if (!list.some((n) => n.id === incoming.id)) {
          // Prepend (newest-first, matching the server's `created_at desc`).
          queryClient.setQueryData<UserNotification[]>(notificationKeys.list(), [
            incoming,
            ...list,
          ])
          // The badge count comes from a separate `unread=true&limit=1` query,
          // so mirror the optimistic prepend on it: a live push is a new unread,
          // so bump the count directly (no refetch). Only when the count has
          // already loaded — an unloaded count refetches the fresh total itself.
          queryClient.setQueryData<number>(
            notificationKeys.unreadCount(),
            (prev) => (typeof prev === 'number' ? prev + 1 : prev),
          )
        }
      } else if (isActivityEvent(message)) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      }
    } catch {
      // Non-JSON keepalive frame (or otherwise malformed) — ignore.
    }
  }

  ws.onclose = () => {
    // Identity guard: `close()` fires asynchronously, so by the time a stale
    // socket's close lands the live socket may already be a newer connection.
    // Only the current, non-unmounted socket may schedule a reconnect —
    // otherwise a superseded socket would orphan the live one.
    if (ws !== refs.ws.current || refs.unmounted.current) return
    const delay = refs.backoff.current
    refs.backoff.current = Math.min(refs.backoff.current * 2, MAX_BACKOFF_MS)
    refs.timer.current = setTimeout(() => {
      // Re-check at fire time: the connection may have been superseded or torn
      // down while the timer was pending.
      if (ws !== refs.ws.current || refs.unmounted.current) return
      connect(queryClient, refs)
    }, delay)
  }

  ws.onerror = () => {
    if (ws !== refs.ws.current) return
    ws.close()
  }
}
