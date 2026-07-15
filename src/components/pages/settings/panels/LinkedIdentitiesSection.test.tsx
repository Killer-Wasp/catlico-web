/**
 * @vitest-environment jsdom
 *
 * Component test for the Linked-accounts (SSO identities) section of the
 * Security panel. Covers the capabilities gate (hidden — and NO network call —
 * unless the platform enables SSO), listing identities, the empty state, the
 * confirm-gated unlink (DELETE only after confirming, row removed on 204), and
 * the 409 "only sign-in method" case (error surfaced, row kept).
 *
 * Mocks the api client (get/delete) and the notifications module — matching
 * MfaSection.test.tsx conventions.
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
import { LinkedIdentitiesSection } from './LinkedIdentitiesSection'
import { api } from '#/lib/api/client'
import { notifications } from '@mantine/notifications'
import type { LinkedIdentity } from '#/lib/auth/identities'
import type { SystemCapabilities } from '#/lib/system/capabilities'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const deleteMock = vi.mocked(api.delete)
const notifyMock = vi.mocked(notifications.show)

const okJson = <T,>(body: T) => ({ json: () => Promise.resolve(body) }) as never

const IDENTITIES: LinkedIdentity[] = [
  {
    id: 'id-okta',
    provider_id: 'prov-1',
    provider_name: 'Okta',
    subject: 'okta|00u123',
    created_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'id-google',
    provider_id: 'prov-2',
    provider_name: 'Google Workspace',
    subject: 'google-oauth2|9988',
    created_at: '2026-07-05T00:00:00Z',
  },
]

function setCapabilities(caps: Partial<SystemCapabilities>) {
  getMock.mockImplementation((path) => {
    if (path === 'system/capabilities')
      return okJson({ sso: false, mfa: false, ...caps })
    if (path === 'auth/identities') return okJson(IDENTITIES)
    return okJson(null)
  })
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <LinkedIdentitiesSection />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

beforeEach(() => {
  getMock.mockReset()
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
  notifyMock.mockReset()
  setCapabilities({ sso: true })
})

afterEach(() => cleanup())

describe('LinkedIdentitiesSection capabilities gate', () => {
  it('renders nothing and NEVER fetches identities when capabilities.sso is false', async () => {
    setCapabilities({ sso: false })
    renderSection()
    // Let the capabilities query resolve first.
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('system/capabilities'),
    )
    expect(screen.queryByText(/linked accounts/i)).toBeNull()
    // The gate must prevent the identities request entirely (not just hide it).
    expect(getMock).not.toHaveBeenCalledWith('auth/identities')
  })

  it('renders the section and lists identities when capabilities.sso is true', async () => {
    renderSection()
    await screen.findByText('Okta')
    // provider_name is prominent, subject is shown too.
    expect(screen.getByText('okta|00u123')).toBeTruthy()
    expect(screen.getByText('Google Workspace')).toBeTruthy()
    expect(screen.getByText('google-oauth2|9988')).toBeTruthy()
    // "linked on" date line.
    expect(screen.getAllByText(/linked on/i).length).toBeGreaterThan(0)
    expect(getMock).toHaveBeenCalledWith('auth/identities')
  })
})

describe('LinkedIdentitiesSection empty state', () => {
  it('shows a quiet empty state when there are no linked accounts', async () => {
    getMock.mockImplementation((path) => {
      if (path === 'system/capabilities') return okJson({ sso: true, mfa: false })
      if (path === 'auth/identities') return okJson([])
      return okJson(null)
    })
    renderSection()
    await screen.findByText(/no linked sso accounts/i)
  })
})

describe('LinkedIdentitiesSection unlink', () => {
  it('is confirm-gated: DELETE fires only after confirming, then removes the row', async () => {
    // Serve the row that goes away after a successful unlink.
    let list = IDENTITIES
    getMock.mockImplementation((path) => {
      if (path === 'system/capabilities') return okJson({ sso: true, mfa: false })
      if (path === 'auth/identities') return okJson(list)
      return okJson(null)
    })
    deleteMock.mockImplementation((() => {
      list = IDENTITIES.filter((identity) => identity.id !== 'id-okta')
      return Promise.resolve({})
    }) as never)

    const { invalidateSpy } = renderSection()
    await screen.findByText('Okta')

    const row = screen.getByTestId('identity-row-id-okta')
    fireEvent.click(within(row).getByRole('button', { name: /unlink/i }))

    // Nothing deleted until the confirm dialog is accepted.
    expect(deleteMock).not.toHaveBeenCalled()

    const confirm = await screen.findByRole('button', { name: /unlink account/i })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('auth/identities/id-okta'),
    )
    // On 204 the list is invalidated and the row disappears.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['identities', 'list'],
      }),
    )
    await waitFor(() => expect(screen.queryByText('Okta')).toBeNull())
    expect(screen.getByText('Google Workspace')).toBeTruthy()
  })

  it('surfaces the 409 "only sign-in method" reason and keeps the row', async () => {
    const conflict = {
      response: { status: 409 },
      data: { detail: 'Cannot unlink your only sign-in method' },
    }
    deleteMock.mockRejectedValue(conflict)

    const { invalidateSpy } = renderSection()
    await screen.findByText('Okta')

    const row = screen.getByTestId('identity-row-id-okta')
    fireEvent.click(within(row).getByRole('button', { name: /unlink/i }))
    fireEvent.click(
      await screen.findByRole('button', { name: /unlink account/i }),
    )

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('auth/identities/id-okta'),
    )
    // The specific server reason is shown...
    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cannot unlink your only sign-in method',
        }),
      ),
    )
    // ...and the row is NOT removed (no list invalidation on a 409).
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['identities', 'list'],
    })
    expect(screen.getByText('Okta')).toBeTruthy()
  })

  it('shows a generic error on a non-409 failure', async () => {
    deleteMock.mockRejectedValue({ response: { status: 500 } })
    renderSection()
    await screen.findByText('Okta')

    const row = screen.getByTestId('identity-row-id-okta')
    fireEvent.click(within(row).getByRole('button', { name: /unlink/i }))
    fireEvent.click(
      await screen.findByRole('button', { name: /unlink account/i }),
    )

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'Could not unlink the SSO account',
        }),
      ),
    )
    expect(screen.getByText('Okta')).toBeTruthy()
  })
})
