// @vitest-environment jsdom
import { notificationKeys } from '#/components/Header/notificationsQueries'
import {
  ORG_CHANGED_EVENT,
  useNotificationSocket,
} from '#/components/Header/useNotificationSocket'
import { getAccessToken, getActiveOrgId } from '#/lib/auth/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/auth/session', () => ({
  getAccessToken: vi.fn(),
  getActiveOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
}))

/**
 * Minimal WebSocket stand-in. Crucially, `close()` fires `onclose`
 * ASYNCHRONOUSLY (via `queueMicrotask`), matching real WebSocket timing — a
 * synchronous close would hide the socket-orphaning race the hook guards
 * against. Tests drive the lifecycle by invoking the handlers directly and
 * flush pending closes with `flushMicrotasks()`.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = []

  url: string
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onclose: ((ev?: unknown) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    if (this.closed) return
    this.closed = true
    queueMicrotask(() => this.onclose?.({}))
  }

  static get live() {
    return MockWebSocket.instances.filter((ws) => !ws.closed)
  }
}

const flushMicrotasks = () => act(async () => Promise.resolve())

function Wrapper({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderSocket(queryClient: QueryClient) {
  return renderHook(() => useNotificationSocket(), {
    wrapper: ({ children }) => (
      <Wrapper queryClient={queryClient}>{children}</Wrapper>
    ),
  })
}

function loggedIn(token: string, orgId: string) {
  vi.mocked(getAccessToken).mockReturnValue(token)
  vi.mocked(getActiveOrgId).mockReturnValue(orgId)
}

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.mocked(getAccessToken).mockReset()
  vi.mocked(getActiveOrgId).mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useNotificationSocket', () => {
  test('opens a socket with the activity path, token, and org id once logged in', () => {
    loggedIn('tok-123', 'org-456')

    renderSocket(new QueryClient())

    expect(MockWebSocket.instances).toHaveLength(1)
    const url = MockWebSocket.instances[0].url
    expect(url).toContain('/api/v1/activity')
    expect(url).toContain('token=tok-123')
    expect(url).toContain('organisation_id=org-456')
  })

  test('invalidates the notifications query when an activity event arrives', () => {
    loggedIn('tok-123', 'org-456')

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderSocket(queryClient)

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'event', event: { id: 'a1' } }),
      })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    })
  })

  test('ignores a plain-text "ping" keepalive frame without throwing or invalidating', () => {
    loggedIn('tok-123', 'org-456')

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderSocket(queryClient)

    const ws = MockWebSocket.instances[0]
    expect(() => ws.onmessage?.({ data: 'ping' })).not.toThrow()
    expect(invalidateSpy).not.toHaveBeenCalled()
    // Replies "pong" to keep the connection alive.
    expect(ws.sent).toContain('pong')
  })

  test('opens no socket when there is no access token', () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getActiveOrgId).mockReturnValue('org-456')

    renderSocket(new QueryClient())

    expect(MockWebSocket.instances).toHaveLength(0)
  })

  test('opens no socket when there is no active org', () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-123')
    vi.mocked(getActiveOrgId).mockReturnValue(null)

    renderSocket(new QueryClient())

    expect(MockWebSocket.instances).toHaveLength(0)
  })

  test('reconnects to the new org on a catlico:org-changed event', async () => {
    loggedIn('tok-123', 'org-456')

    renderSocket(new QueryClient())
    const first = MockWebSocket.instances[0]
    expect(first.url).toContain('organisation_id=org-456')

    // Switch org, then fire the same-tab signal.
    vi.mocked(getActiveOrgId).mockReturnValue('org-999')
    act(() => {
      window.dispatchEvent(new Event(ORG_CHANGED_EVENT))
    })
    await flushMicrotasks()

    // Old socket closed; a fresh one opened against the new org.
    expect(first.closed).toBe(true)
    expect(MockWebSocket.instances).toHaveLength(2)
    const second = MockWebSocket.instances[1]
    expect(second.url).toContain('organisation_id=org-999')
    // Exactly one live socket — the old one was not orphaned.
    expect(MockWebSocket.live).toEqual([second])
  })

  test('org-change with no session tears down without reconnecting', async () => {
    loggedIn('tok-123', 'org-456')

    renderSocket(new QueryClient())
    const first = MockWebSocket.instances[0]

    // Logged out at the moment of the switch.
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getActiveOrgId).mockReturnValue(null)
    act(() => {
      window.dispatchEvent(new Event(ORG_CHANGED_EVENT))
    })
    await flushMicrotasks()

    expect(first.closed).toBe(true)
    expect(MockWebSocket.live).toHaveLength(0)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  test('unmount closes the socket and never reconnects afterwards', async () => {
    vi.useFakeTimers()
    loggedIn('tok-123', 'org-456')

    const { unmount } = renderSocket(new QueryClient())
    const ws = MockWebSocket.instances[0]

    unmount()
    // Flush the async close and any backoff timers that a leaked handler
    // might have armed.
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(ws.closed).toBe(true)
    // No reconnect: still just the one socket, and none live.
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.live).toHaveLength(0)
  })

  test("a stale socket's late close does not orphan the live socket or reconnect", async () => {
    vi.useFakeTimers()
    loggedIn('tok-123', 'org-456')

    renderSocket(new QueryClient())
    const first = MockWebSocket.instances[0]

    // Supersede the first socket via an org change (its close is now pending).
    vi.mocked(getActiveOrgId).mockReturnValue('org-999')
    act(() => {
      window.dispatchEvent(new Event(ORG_CHANGED_EVENT))
    })
    const second = MockWebSocket.instances[1]

    // Let the first socket's late close fire and run any timers it might arm.
    await act(async () => {
      await Promise.resolve()
      vi.runAllTimers()
      await Promise.resolve()
    })

    // The stale close neither reconnected nor closed the live socket.
    expect(MockWebSocket.instances).toHaveLength(2)
    expect(MockWebSocket.live).toEqual([second])
    expect(first.closed).toBe(true)
    expect(second.closed).toBe(false)
  })

  test('reconnects with backoff after the live socket drops', async () => {
    vi.useFakeTimers()
    loggedIn('tok-123', 'org-456')

    renderSocket(new QueryClient())
    const first = MockWebSocket.instances[0]
    act(() => first.onopen?.())

    // Simulate an unexpected server-side drop: close() fires onclose async,
    // which arms the backoff timer.
    await act(async () => {
      first.close()
      await Promise.resolve()
    })
    // Nothing reconnects until the 1s initial backoff elapses.
    expect(MockWebSocket.instances).toHaveLength(1)
    await act(async () => {
      vi.advanceTimersByTime(1_000)
      await Promise.resolve()
    })

    expect(MockWebSocket.instances).toHaveLength(2)
    // The dropped socket is closed; only the reconnected one is live.
    expect(MockWebSocket.live).toHaveLength(1)
    expect(first.closed).toBe(true)
  })
})
