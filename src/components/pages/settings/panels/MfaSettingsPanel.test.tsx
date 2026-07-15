/**
 * @vitest-environment jsdom
 *
 * Component test for the superadmin-only "MFA policy" settings panel
 * (`/admin/mfa/settings`). It:
 *  - initialises both switches from the GET,
 *  - saves EVERY change as a FULL-REPLACE PUT carrying BOTH `enabled` and
 *    `enforced` (the load-bearing contract — a partial body silently clobbers
 *    the other field on the backend),
 *  - disables "Enforce" while "Require MFA" is off,
 *  - renders nothing (and never GETs) when the platform lacks the MFA
 *    capability,
 *  - is gated out of the settings nav for non-superadmins and MFA-less builds,
 *    exactly as the Identity-providers section is.
 *
 * Mocks the api client, notifications, permissions and the auth-session helpers,
 * matching IdentityProvidersPanel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MfaSettingsPanel } from './MfaSettingsPanel'
import { SettingsLayout } from '#/components/pages/SettingsPage'
import { api } from '#/lib/api/client'
import type { SystemCapabilities } from '#/lib/system/capabilities'
import type { MfaSettings } from '#/lib/system/mfaSettings'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

// Mutable so the section-gating tests can flip superadmin on/off.
const permissionsState = {
  can: () => true,
  isSuperadmin: true,
  groups: [] as string[],
  isLoaded: true,
  isLoading: false,
}
vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => permissionsState,
}))

vi.mock('#/lib/auth/session', () => ({
  getActiveOrgId: () => 'org-1',
  getSessionOrganisationIds: () => ['org-1'],
}))

// SettingsLayout pulls in the router; stub the hooks it uses at render time.
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ section: undefined }),
  useNavigate: () => vi.fn(),
  Outlet: () => null,
}))

const getMock = vi.mocked(api.get)
const putMock = vi.mocked(api.put)

const okJson = <T,>(body: T) => ({ json: () => Promise.resolve(body) }) as never

// GET wiring: capabilities (MFA on by default) + the current MFA settings.
function wireGet(
  settings: MfaSettings = { enabled: true, enforced: false },
  caps: Partial<SystemCapabilities> = { mfa: true },
) {
  getMock.mockImplementation(((url: string) => {
    if (url === 'system/capabilities')
      return okJson({ sso: false, mfa: false, ...caps })
    if (url === 'admin/mfa/settings') return okJson(settings)
    return okJson(null)
  }) as never)
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPanel() {
  render(
    <QueryClientProvider client={makeClient()}>
      <MantineProvider>
        <ModalsProvider>
          <MfaSettingsPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

function renderLayout() {
  render(
    <QueryClientProvider client={makeClient()}>
      <MantineProvider>
        <SettingsLayout />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  permissionsState.isSuperadmin = true
  getMock.mockReset()
  wireGet()
  putMock.mockReset()
  putMock.mockReturnValue(okJson({ enabled: true, enforced: false }))
})
afterEach(() => cleanup())

describe('MfaSettingsPanel switches', () => {
  it('initialises both switches from the GET', async () => {
    wireGet({ enabled: true, enforced: false })
    renderPanel()
    const requireSwitch = await screen.findByRole('switch', {
      name: /require mfa/i,
    })
    const enforceSwitch = screen.getByRole('switch', {
      name: /enforce for all members/i,
    })
    expect((requireSwitch as HTMLInputElement).checked).toBe(true)
    expect((enforceSwitch as HTMLInputElement).checked).toBe(false)
  })

  it('toggling "Require MFA" PUTs with BOTH enabled and enforced', async () => {
    wireGet({ enabled: false, enforced: true })
    renderPanel()
    const requireSwitch = await screen.findByRole('switch', {
      name: /require mfa/i,
    })
    fireEvent.click(requireSwitch)

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith('admin/mfa/settings', {
        json: { enabled: true, enforced: true },
      }),
    )
    const body = putMock.mock.calls[0][1]?.json as Record<string, unknown>
    expect(body).toHaveProperty('enabled')
    expect(body).toHaveProperty('enforced')
  })

  it('toggling "Enforce" PUTs with BOTH enabled and enforced', async () => {
    wireGet({ enabled: true, enforced: false })
    renderPanel()
    const enforceSwitch = await screen.findByRole('switch', {
      name: /enforce for all members/i,
    })
    fireEvent.click(enforceSwitch)

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith('admin/mfa/settings', {
        json: { enabled: true, enforced: true },
      }),
    )
    const body = putMock.mock.calls[0][1]?.json as Record<string, unknown>
    expect(body).toHaveProperty('enabled')
    expect(body).toHaveProperty('enforced')
  })

  it('disables the "Enforce" switch while "Require MFA" is off', async () => {
    wireGet({ enabled: false, enforced: false })
    renderPanel()
    const enforceSwitch = await screen.findByRole('switch', {
      name: /enforce for all members/i,
    })
    expect((enforceSwitch as HTMLInputElement).disabled).toBe(true)
  })
})

describe('MfaSettingsPanel capability gate', () => {
  it('renders nothing and never GETs settings when MFA capability is off', async () => {
    wireGet({ enabled: true, enforced: false }, { mfa: false })
    renderPanel()
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('system/capabilities'),
    )
    expect(screen.queryByRole('switch', { name: /require mfa/i })).toBeNull()
    expect(getMock).not.toHaveBeenCalledWith('admin/mfa/settings')
  })
})

describe('MfaSettingsPanel section gating', () => {
  it('shows the "MFA policy" section to a superadmin on an MFA build', async () => {
    permissionsState.isSuperadmin = true
    wireGet({ enabled: true, enforced: false }, { mfa: true })
    renderLayout()
    expect(await screen.findByText('MFA policy')).toBeTruthy()
  })

  it('hides the "MFA policy" section from a non-superadmin', async () => {
    permissionsState.isSuperadmin = false
    wireGet({ enabled: true, enforced: false }, { mfa: true })
    renderLayout()
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('system/capabilities'),
    )
    expect(screen.queryByText('MFA policy')).toBeNull()
  })

  it('hides the "MFA policy" section when the MFA capability is off', async () => {
    permissionsState.isSuperadmin = true
    wireGet({ enabled: true, enforced: false }, { mfa: false })
    renderLayout()
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('system/capabilities'),
    )
    expect(screen.queryByText('MFA policy')).toBeNull()
  })
})
