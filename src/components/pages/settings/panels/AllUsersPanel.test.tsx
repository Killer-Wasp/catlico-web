/**
 * @vitest-environment jsdom
 *
 * Component test for the "All users" settings panel — the GLOBAL user resource
 * (accounts across all orgs), distinct from the org-members UsersPanel. It:
 *  - lists accounts with active / superadmin badges,
 *  - gates the whole section to superadmins (mirrors the Audit-log gate),
 *  - creates a password-less account via a two-step wizard: step 1 POSTs
 *    `/users/` (no password — the backend emails a set-password invite), step 2
 *    optionally chains `POST /organisations/{orgId}/members`,
 *  - hides Delete on the current user's own row,
 *  - edits an account via PATCH `/users/{id}`, including the force-reset switch.
 *
 * Mocks the api client, notifications, permissions, and the auth-session helpers
 * (getActiveOrgId + requestPasswordReset), matching ReportTemplatesPanel.test.tsx.
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
import { notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AllUsersPanel } from './AllUsersPanel'
import { SettingsLayout } from '#/components/pages/SettingsPage'
import { api } from '#/lib/api/client'
import { requestPasswordReset } from '#/lib/auth/session'
import type {
  OrganisationPublic,
  RolePublic,
  UserPublic,
} from '#/components/pages/settings/settingsQueries'

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
  requestPasswordReset: vi.fn(() => Promise.resolve()),
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
const resetMock = vi.mocked(requestPasswordReset)
const showMock = vi.mocked(notifications.show)

const ME: UserPublic = {
  id: 'u-me',
  email: 'admin@example.com',
  first_name: 'Ada',
  last_name: 'Min',
  is_active: true,
  is_superadmin: true,
  has_avatar: false,
  must_change_password: false,
  created_at: '2026-07-01T00:00:00Z',
  last_login_at: '2026-07-13T00:00:00Z',
}

const OTHER: UserPublic = {
  id: 'u-2',
  email: 'analyst@example.com',
  first_name: 'Ana',
  last_name: 'Lyst',
  is_active: false,
  is_superadmin: false,
  has_avatar: false,
  must_change_password: false,
  created_at: '2026-07-05T00:00:00Z',
  last_login_at: null,
}

const USERS = [ME, OTHER]

const ORGS: OrganisationPublic[] = [
  {
    id: 'org-1',
    name: 'Acme SOC',
    description: '',
    timezone: 'UTC',
    default_tlp: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
  },
]

const ROLES: RolePublic[] = [
  {
    id: 'role-analyst',
    organisation_id: 'org-1',
    name: 'analyst',
    permissions: [],
    created_at: '2026-01-01T00:00:00Z',
    is_builtin: true,
  },
]

function wireGet() {
  getMock.mockImplementation(((url: string) => {
    if (url === 'users/') return { json: () => Promise.resolve(USERS) }
    if (url === 'users/me') return { json: () => Promise.resolve(ME) }
    if (url === 'organisations/') return { json: () => Promise.resolve(ORGS) }
    if (url === 'roles/') return { json: () => Promise.resolve(ROLES) }
    return { json: () => Promise.resolve([]) }
  }) as never)
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
          <AllUsersPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
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
  postMock.mockReset()
  postMock.mockReturnValue({
    json: () => Promise.resolve({ ...OTHER, id: 'u-new' }),
  } as never)
  patchMock.mockReset()
  patchMock.mockReturnValue({
    json: () => Promise.resolve({ ...OTHER }),
  } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
  resetMock.mockReset()
  resetMock.mockResolvedValue(undefined)
  showMock.mockReset()
})
afterEach(() => cleanup())

describe('AllUsersPanel section gating', () => {
  it('shows the "All users" section to a superadmin', () => {
    permissionsState.isSuperadmin = true
    renderLayout()
    expect(screen.getByText('All users')).toBeTruthy()
  })

  it('hides the "All users" section from a non-superadmin', () => {
    permissionsState.isSuperadmin = false
    renderLayout()
    expect(screen.queryByText('All users')).toBeNull()
  })
})

describe('AllUsersPanel', () => {
  it('lists accounts with active and superadmin badges', async () => {
    renderPanel()
    await screen.findByText('admin@example.com')
    expect(screen.getByText('analyst@example.com')).toBeTruthy()
    expect(screen.getByText('Ada Min')).toBeTruthy()
    // Badges: the superadmin account carries a "Superadmin" badge; the inactive
    // account carries an "Inactive" badge.
    expect(screen.getByText('Superadmin')).toBeTruthy()
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  it('does not offer Delete on the current user\'s own row, but does on others', async () => {
    renderPanel()
    await screen.findByText('admin@example.com')
    expect(
      screen.queryByRole('button', { name: /delete admin@example\.com/i }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /delete analyst@example\.com/i }),
    ).toBeTruthy()
  })

  it('deletes another account after confirming, calling DELETE /users/{id}', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('analyst@example.com')

    fireEvent.click(
      screen.getByRole('button', { name: /delete analyst@example\.com/i }),
    )
    const confirm = await screen.findByRole('button', { name: 'Delete account' })
    fireEvent.click(confirm)

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('users/u-2'))
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'users'],
      }),
    )
  })

  it('creates an account (step 1) and, skipping step 2, POSTs only /users/', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('admin@example.com')

    fireEvent.click(screen.getByRole('button', { name: /new user account/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: 'newbie@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'New' },
    })
    fireEvent.change(within(dialog).getByLabelText(/last name/i), {
      target: { value: 'Bie' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: /continue/i }))
    // Step 2: skip the org attachment and create the account only.
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /skip & create/i }),
    )

    // Always password-less: the POST body carries no password (the backend emails
    // a set-password invite).
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('users/', {
        json: {
          email: 'newbie@example.com',
          first_name: 'New',
          last_name: 'Bie',
          is_superadmin: false,
        },
      }),
    )
    // Account-only: no org membership call.
    expect(
      postMock.mock.calls.some(([url]) => String(url).includes('/members')),
    ).toBe(false)
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'users'],
      }),
    )
  })

  it('completing step 2 chains POST /organisations/{orgId}/members with the account', async () => {
    renderPanel()
    await screen.findByText('admin@example.com')

    fireEvent.click(screen.getByRole('button', { name: /new user account/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: 'newbie@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'New' },
    })
    fireEvent.change(within(dialog).getByLabelText(/last name/i), {
      target: { value: 'Bie' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /continue/i }))

    // Step 2: pick an org (loads its roles), then a role. The role options are
    // fetched asynchronously for the chosen org, so wait for one to appear.
    fireEvent.change(await within(dialog).findByLabelText(/organisation/i), {
      target: { value: 'org-1' },
    })
    await within(dialog).findByRole('option', { name: 'analyst' })
    fireEvent.change(within(dialog).getByLabelText(/role/i), {
      target: { value: 'role-analyst' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: /create & add to org/i }),
    )

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('users/', expect.anything()),
    )
    // The chain uses the definitive id returned by createUser (mock → 'u-new'),
    // not the email, to avoid any normalisation mismatch.
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('organisations/org-1/members', {
        json: { user_id: 'u-new', role_id: 'role-analyst' },
      }),
    )
  })

  it('creates a password-less account (no password field, no client-side reset call) and toasts the invite', async () => {
    renderPanel()
    await screen.findByText('admin@example.com')

    fireEvent.click(screen.getByRole('button', { name: /new user account/i }))
    const dialog = await screen.findByRole('dialog')

    // There is no password field or password-mode radio anymore.
    expect(within(dialog).queryByLabelText(/^password/i)).toBeNull()
    expect(within(dialog).queryByLabelText(/send a reset link/i)).toBeNull()

    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: 'newbie@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'New' },
    })
    fireEvent.change(within(dialog).getByLabelText(/last name/i), {
      target: { value: 'Bie' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /continue/i }))
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /skip & create/i }),
    )

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('users/', {
        json: {
          email: 'newbie@example.com',
          first_name: 'New',
          last_name: 'Bie',
          is_superadmin: false,
        },
      }),
    )
    // The backend owns the invite email: the client never calls forgot-password.
    expect(resetMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(showMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Account created — set-password invite sent',
        }),
      ),
    )
  })

  it('edits an account, PATCHing /users/{id} with the changed fields', async () => {
    renderPanel()
    await screen.findByText('analyst@example.com')

    fireEvent.click(
      screen.getByRole('button', { name: /edit analyst@example\.com/i }),
    )
    const dialog = await screen.findByRole('dialog')
    // No admin password field on the edit modal either.
    expect(within(dialog).queryByLabelText(/new password/i)).toBeNull()
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: 'Anastasia' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        'users/u-2',
        expect.objectContaining({
          json: expect.objectContaining({ first_name: 'Anastasia' }),
        }),
      ),
    )
  })

  it('toggles "Require password reset on next login", PATCHing must_change_password', async () => {
    renderPanel()
    await screen.findByText('analyst@example.com')

    fireEvent.click(
      screen.getByRole('button', { name: /edit analyst@example\.com/i }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByLabelText(/require password reset on next login/i),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        'users/u-2',
        expect.objectContaining({
          json: expect.objectContaining({ must_change_password: true }),
        }),
      ),
    )
  })

  it('sends a reset link from the edit modal via forgot-password', async () => {
    renderPanel()
    await screen.findByText('analyst@example.com')

    fireEvent.click(
      screen.getByRole('button', { name: /edit analyst@example\.com/i }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /send reset link/i }))

    await waitFor(() =>
      expect(resetMock).toHaveBeenCalledWith('analyst@example.com'),
    )
  })
})
