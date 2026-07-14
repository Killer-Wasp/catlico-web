/**
 * @vitest-environment jsdom
 *
 * Component test for the Security settings panel: it lists the caller's active
 * sessions with a human-friendly device line and the ip address, marks the
 * current session with a "Current session" badge, and revokes a session via a
 * confirm dialog that calls `DELETE /auth/sessions/{id}` and invalidates the
 * list. Revoking the CURRENT session shows an extra sign-out warning.
 *
 * Mocks the api client (get/delete), the auth session helpers, and the
 * notifications module — matching ReportTemplatesPanel.test.tsx conventions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SecurityPanel, formatUserAgent } from './SecurityPanel'
import { api } from '#/lib/api/client'
import { logout } from '#/lib/auth/session'
import { redirectToLogin } from '#/lib/auth/redirects'
import type { SessionPublic } from '#/components/pages/settings/settingsQueries'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('#/lib/auth/session', () => ({
  getActiveOrgId: () => 'org-1',
  getSessionOrganisationIds: () => ['org-1'],
  logout: vi.fn(),
}))

vi.mock('#/lib/auth/redirects', () => ({
  redirectToLogin: vi.fn(),
}))

const getMock = vi.mocked(api.get)
const deleteMock = vi.mocked(api.delete)
const logoutMock = vi.mocked(logout)
const redirectMock = vi.mocked(redirectToLogin)

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'

const SESSIONS: SessionPublic[] = [
  {
    // Older than the current one, so a naive created_at sort would put it first;
    // the panel must still float the current session to the top.
    id: 's-other',
    created_at: '2026-07-10T00:00:00Z',
    expires_at: '2026-07-24T00:00:00Z',
    user_agent: FIREFOX_WIN,
    ip_address: '5.6.7.8',
    is_current: false,
  },
  {
    id: 's-current',
    created_at: '2026-07-13T00:00:00Z',
    expires_at: '2026-07-27T00:00:00Z',
    user_agent: CHROME_MAC,
    ip_address: '1.2.3.4',
    is_current: true,
  },
]

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <SecurityPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({ json: () => Promise.resolve(SESSIONS) } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
  logoutMock.mockReset()
  redirectMock.mockReset()
})
afterEach(() => cleanup())

describe('SecurityPanel', () => {
  it('lists sessions with a friendly device line and the current-session badge on the current row', async () => {
    renderPanel()
    // Device line is parsed from the user agent.
    await screen.findByText('Chrome on macOS')
    expect(screen.getByText('Firefox on Windows')).toBeTruthy()
    // IP addresses render.
    expect(screen.getByText('1.2.3.4')).toBeTruthy()
    expect(screen.getByText('5.6.7.8')).toBeTruthy()

    // The badge sits on the current session's row, not the other one.
    const currentRow = screen.getByTestId('session-row-s-current')
    expect(within(currentRow).getByText(/current session/i)).toBeTruthy()
    const otherRow = screen.getByTestId('session-row-s-other')
    expect(within(otherRow).queryByText(/current session/i)).toBeNull()
  })

  it('sorts the current session first even when it is not the newest', async () => {
    renderPanel()
    await screen.findByText('Chrome on macOS')
    const rows = screen.getAllByTestId(/^session-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('session-row-s-current')
  })

  it('revokes a non-current session after confirming, DELETEing the session and invalidating the list', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('Firefox on Windows')

    const otherRow = screen.getByTestId('session-row-s-other')
    fireEvent.click(within(otherRow).getByRole('button', { name: /revoke/i }))

    const confirm = await screen.findByRole('button', { name: 'Revoke session' })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('auth/sessions/s-other'),
    )
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'sessions'],
      }),
    )
    // A non-current revoke stays in-app — it must not sign the user out.
    expect(logoutMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('warns that revoking the current session signs you out, then actually signs out', async () => {
    renderPanel()
    await screen.findByText('Chrome on macOS')

    const currentRow = screen.getByTestId('session-row-s-current')
    fireEvent.click(within(currentRow).getByRole('button', { name: /revoke/i }))

    // The confirm dialog for the current session carries the extra sign-out copy.
    await screen.findByText(/this will sign you out/i)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke session' }))

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('auth/sessions/s-current'),
    )
    // Revoking the session you're on completes the sign-out for real: the local
    // session is torn down and the app bounces to login (making the promise true).
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1))
    expect(redirectMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to "Unknown device" when the user agent is null', async () => {
    getMock.mockReturnValue({
      json: () =>
        Promise.resolve([
          {
            id: 's-null',
            created_at: '2026-07-13T00:00:00Z',
            expires_at: '2026-07-27T00:00:00Z',
            user_agent: null,
            ip_address: null,
            is_current: false,
          },
        ] satisfies SessionPublic[]),
    } as never)
    renderPanel()
    await screen.findByText('Unknown device')
    // Null ip renders as an em dash.
    expect(screen.getByText('—')).toBeTruthy()
  })
})

describe('formatUserAgent', () => {
  it('returns "Unknown device" for a null user agent', () => {
    expect(formatUserAgent(null)).toBe('Unknown device')
  })

  it('picks Edge over Chrome/Safari (both appear in an Edge UA)', () => {
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(formatUserAgent(edge)).toBe('Edge on Windows')
  })

  it('recognises real Safari (Version/…Safari, no Chrome) on macOS', () => {
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    expect(formatUserAgent(safari)).toBe('Safari on macOS')
  })

  it('falls back to the raw UA when neither half is recognised', () => {
    expect(formatUserAgent('curl/8.4.0')).toBe('curl/8.4.0')
  })
})
