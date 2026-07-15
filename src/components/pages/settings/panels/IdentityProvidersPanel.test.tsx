/**
 * @vitest-environment jsdom
 *
 * Component test for the "Identity providers" settings panel — superadmin-only
 * CRUD over OIDC SSO providers (`/admin/oidc/providers`). It:
 *  - gates the whole section to superadmins (mirrors the All-users gate),
 *  - lists providers with a "secret configured" indicator and NEVER the secret,
 *  - creates a provider, sending the client secret as `secrets.client_secret`,
 *  - edits a provider without prefilling the (unreturned) secret; the rotate
 *    flow reveals a fresh input and PATCHes `secrets.client_secret`, and a
 *    "remove secret" option PATCHes `secrets.client_secret = null`,
 *  - surfaces the backend 400 `detail` (unknown org/role) as a friendly error,
 *  - deletes a provider after confirming.
 *
 * Mocks the api client, notifications, permissions and the auth-session helpers,
 * matching AllUsersPanel.test.tsx.
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
import { HTTPError } from 'ky'
import { IdentityProvidersPanel } from './IdentityProvidersPanel'
import { AdminLayout } from '#/components/pages/SettingsPage'
import { api } from '#/lib/api/client'
import type { OidcProviderPublic } from '#/components/pages/settings/settingsQueries'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
const postMock = vi.mocked(api.post)
const patchMock = vi.mocked(api.patch)
const deleteMock = vi.mocked(api.delete)

const OKTA: OidcProviderPublic = {
  id: 'oidc-1',
  slug: 'okta',
  name: 'Okta',
  issuer: 'https://okta.example.com',
  client_id: 'okta-client-123',
  has_client_secret: true,
  scopes: ['openid', 'email'],
  default_org_slug: 'acme',
  default_role_name: 'analyst',
  enabled: true,
  created_at: '2026-07-01T00:00:00Z',
}

const AZURE: OidcProviderPublic = {
  id: 'oidc-2',
  slug: 'azure',
  name: 'Azure AD',
  issuer: 'https://login.microsoftonline.com',
  client_id: 'azure-client-456',
  has_client_secret: false,
  scopes: [],
  default_org_slug: 'globex',
  default_role_name: 'read-only',
  enabled: false,
  created_at: '2026-07-02T00:00:00Z',
}

const PROVIDERS = [OKTA, AZURE]

function wireGet() {
  getMock.mockImplementation(((url: string) => {
    if (url === 'admin/oidc/providers')
      return { json: () => Promise.resolve(PROVIDERS) }
    return { json: () => Promise.resolve([]) }
  }) as never)
}

function makeHttpError(status: number, detail: string): HTTPError {
  const response = new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
  return new HTTPError(
    response,
    new Request('http://localhost/api/v1/admin/oidc/providers'),
    {} as never,
  )
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPanel() {
  const client = makeClient()
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <IdentityProvidersPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

function renderLayout() {
  // Identity providers lives on the Admin page's section list now.
  render(
    <QueryClientProvider client={makeClient()}>
      <MantineProvider>
        <AdminLayout />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

async function openCreate() {
  fireEvent.click(screen.getByRole('button', { name: /add provider/i }))
  return screen.findByRole('dialog')
}

function fillCreateForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/slug/i), {
    target: { value: 'google' },
  })
  fireEvent.change(within(dialog).getByLabelText(/^name/i), {
    target: { value: 'Google Workspace' },
  })
  fireEvent.change(within(dialog).getByLabelText(/issuer/i), {
    target: { value: 'https://accounts.google.com' },
  })
  fireEvent.change(within(dialog).getByLabelText(/client id/i), {
    target: { value: 'google-client-789' },
  })
  fireEvent.change(within(dialog).getByLabelText(/default organisation/i), {
    target: { value: 'acme' },
  })
  fireEvent.change(within(dialog).getByLabelText(/default role/i), {
    target: { value: 'analyst' },
  })
  fireEvent.change(within(dialog).getByLabelText(/client secret/i), {
    target: { value: 'sup3r-secret' },
  })
}

beforeEach(() => {
  permissionsState.isSuperadmin = true
  getMock.mockReset()
  wireGet()
  postMock.mockReset()
  postMock.mockReturnValue({
    json: () => Promise.resolve({ ...OKTA, id: 'oidc-new' }),
  } as never)
  patchMock.mockReset()
  patchMock.mockReturnValue({
    json: () => Promise.resolve({ ...OKTA }),
  } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
})
afterEach(() => cleanup())

describe('IdentityProvidersPanel section gating', () => {
  it('shows the "Identity providers" section to a superadmin', () => {
    permissionsState.isSuperadmin = true
    renderLayout()
    expect(screen.getByText('Identity providers')).toBeTruthy()
  })

  it('hides the "Identity providers" section from a non-superadmin', () => {
    permissionsState.isSuperadmin = false
    renderLayout()
    expect(screen.queryByText('Identity providers')).toBeNull()
  })
})

describe('IdentityProvidersPanel list', () => {
  it('lists providers with details and a secret-configured indicator, never the secret', async () => {
    renderPanel()
    await screen.findByText('Okta')
    expect(screen.getByText('Azure AD')).toBeTruthy()
    // Slugs, issuers and client ids are shown.
    expect(screen.getByText('okta')).toBeTruthy()
    expect(screen.getByText('https://okta.example.com')).toBeTruthy()
    expect(screen.getByText('okta-client-123')).toBeTruthy()
    // Default org + role.
    expect(screen.getByText('acme')).toBeTruthy()
    expect(screen.getByText('analyst')).toBeTruthy()
    // Enabled state.
    expect(screen.getByText('Enabled')).toBeTruthy()
    expect(screen.getByText('Disabled')).toBeTruthy()
    // Secret-configured indicator: Okta has one, Azure does not.
    expect(screen.getByText('Secret configured')).toBeTruthy()
    expect(screen.getByText('No secret')).toBeTruthy()
    // The secret value itself is never present anywhere.
    expect(screen.queryByText('sup3r-secret')).toBeNull()
  })
})

describe('IdentityProvidersPanel create', () => {
  it('creates a provider, sending the client secret as secrets.client_secret and invalidating the list', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('Okta')

    const dialog = await openCreate()
    fillCreateForm(dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: /create provider/i }),
    )

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('admin/oidc/providers', {
        json: expect.objectContaining({
          slug: 'google',
          name: 'Google Workspace',
          issuer: 'https://accounts.google.com',
          client_id: 'google-client-789',
          default_org_slug: 'acme',
          default_role_name: 'analyst',
          enabled: true,
          secrets: { client_secret: 'sup3r-secret' },
        }),
      }),
    )
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'oidc-providers'],
      }),
    )
  })

  it('surfaces the backend 400 detail for an unknown org/role', async () => {
    postMock.mockReturnValue({
      json: () =>
        Promise.reject(makeHttpError(400, 'Default organisation not found')),
    } as never)
    renderPanel()
    await screen.findByText('Okta')

    const dialog = await openCreate()
    fillCreateForm(dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: /create provider/i }),
    )

    // The friendly detail shows in the still-open dialog rather than crashing.
    expect(
      await within(dialog).findByText(/default organisation not found/i),
    ).toBeTruthy()
  })
})

describe('IdentityProvidersPanel edit', () => {
  it('does not prefill the secret and shows the configured badge', async () => {
    renderPanel()
    await screen.findByText('Okta')

    fireEvent.click(screen.getByRole('button', { name: /edit okta/i }))
    const dialog = await screen.findByRole('dialog')

    // Prefilled scalar fields...
    expect(within(dialog).getByLabelText(/^name/i)).toHaveValue('Okta')
    // ...but no secret input is present until the rotate affordance is used.
    expect(within(dialog).queryByLabelText(/client secret/i)).toBeNull()
    expect(within(dialog).getByText(/secret configured/i)).toBeTruthy()
  })

  it('rotates the secret, PATCHing only secrets.client_secret', async () => {
    renderPanel()
    await screen.findByText('Okta')

    fireEvent.click(screen.getByRole('button', { name: /edit okta/i }))
    const dialog = await screen.findByRole('dialog')

    // Reveal a fresh, empty secret input via the rotate affordance.
    fireEvent.click(
      within(dialog).getByRole('button', { name: /set.*secret|rotate secret/i }),
    )
    const secretInput = within(dialog).getByLabelText(/client secret/i)
    expect(secretInput).toHaveValue('')
    fireEvent.change(secretInput, { target: { value: 'rotated-secret' } })

    fireEvent.click(
      within(dialog).getByRole('button', { name: /save changes/i }),
    )

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('admin/oidc/providers/oidc-1', {
        json: { secrets: { client_secret: 'rotated-secret' } },
      }),
    )
  })

  it('removes the stored secret, PATCHing secrets.client_secret = null', async () => {
    renderPanel()
    await screen.findByText('Okta')

    fireEvent.click(screen.getByRole('button', { name: /edit okta/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByLabelText(/remove stored secret/i))
    fireEvent.click(
      within(dialog).getByRole('button', { name: /save changes/i }),
    )

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('admin/oidc/providers/oidc-1', {
        json: { secrets: { client_secret: null } },
      }),
    )
  })
})

describe('IdentityProvidersPanel delete', () => {
  it('deletes a provider after confirming, calling DELETE and invalidating', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('Okta')

    fireEvent.click(screen.getByRole('button', { name: /delete okta/i }))
    const confirm = await screen.findByRole('button', {
      name: 'Delete provider',
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('admin/oidc/providers/oidc-1'),
    )
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'oidc-providers'],
      }),
    )
  })
})
