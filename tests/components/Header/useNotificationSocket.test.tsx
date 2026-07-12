// @vitest-environment jsdom
import { notificationKeys } from '#/components/Header/notificationsQueries'
import { useNotificationSocket } from '#/components/Header/useNotificationSocket'
import { getAccessToken, getActiveOrgId } from '#/lib/auth/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/auth/session', () => ({
  getAccessToken: vi.fn(),
  getActiveOrgId: vi.fn(),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
}))

/** Minimal WebSocket stand-in: records the constructed URL and lets tests
 * drive the connection lifecycle by invoking the handlers directly. */
class MockWebSocket {
  static instances: MockWebSocket[] = []

  url: string
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
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
    this.onclose?.()
  }
}

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

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.mocked(getAccessToken).mockReset()
  vi.mocked(getActiveOrgId).mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useNotificationSocket', () => {
  test('opens a socket with the activity path, token, and org id once logged in', () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-123')
    vi.mocked(getActiveOrgId).mockReturnValue('org-456')

    const queryClient = new QueryClient()
    renderSocket(queryClient)

    expect(MockWebSocket.instances).toHaveLength(1)
    const url = MockWebSocket.instances[0].url
    expect(url).toContain('/api/v1/activity')
    expect(url).toContain('token=tok-123')
    expect(url).toContain('organisation_id=org-456')
  })

  test('invalidates the notifications query when an activity event arrives', () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-123')
    vi.mocked(getActiveOrgId).mockReturnValue('org-456')

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderSocket(queryClient)

    const ws = MockWebSocket.instances[0]
    ws.onmessage?.({
      data: JSON.stringify({ type: 'event', event: { id: 'a1' } }),
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    })
  })

  test('ignores a plain-text "ping" keepalive frame without throwing or invalidating', () => {
    vi.mocked(getAccessToken).mockReturnValue('tok-123')
    vi.mocked(getActiveOrgId).mockReturnValue('org-456')

    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderSocket(queryClient)

    const ws = MockWebSocket.instances[0]
    expect(() => ws.onmessage?.({ data: 'ping' })).not.toThrow()
    expect(invalidateSpy).not.toHaveBeenCalled()
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
})
