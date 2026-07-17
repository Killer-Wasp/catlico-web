/**
 * @vitest-environment jsdom
 *
 * Component test for the Profiles (roles) settings panel and its handling of
 * built-in roles. The backend marks the three shipped roles with
 * `is_builtin: true` and 409s on any attempt to PATCH/DELETE them, so the panel:
 *   - shows a "Built-in" badge on built-in roles in the list,
 *   - hides the save (edit) and delete affordances while a built-in is selected
 *     (its permissions stay viewable, but read-only),
 *   - still lets custom roles be edited and deleted,
 *   - and, as defense in depth, surfaces a 409 `detail` as a friendly error.
 *
 * Mocks the api client (get/patch/delete), the permissions hook (admin), the
 * notifications module, and the session helpers.
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
import { HTTPError } from 'ky'
import { ProfilesPanel } from '#/components/pages/settings/panels/ProfilesPanel'
import { api } from '#/lib/api/client'
import { notifications } from '@mantine/notifications'
import type {
  PermissionInfo,
  RolePublic,
} from '#/components/pages/settings/settingsQueries'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isSuperadmin: true,
    groups: [],
    isLoaded: true,
    isLoading: false,
  }),
}))

vi.mock('#/lib/auth/session', () => ({
  getActiveOrgId: () => 'org-1',
  getSessionOrganisationIds: () => ['org-1'],
}))

const getMock = vi.mocked(api.get)
const patchMock = vi.mocked(api.patch)
const deleteMock = vi.mocked(api.delete)
const showMock = vi.mocked(notifications.show)

const CATALOG: PermissionInfo[] = [
  {
    key: 'read:case',
    domain: 'Investigation',
    kind: 'read',
    label: 'Read cases',
    description: '',
  },
  {
    key: 'write:case',
    domain: 'Investigation',
    kind: 'write',
    label: 'Write cases',
    description: '',
  },
]

const BUILTIN: RolePublic = {
  id: 'r-builtin',
  organisation_id: 'org-1',
  name: 'org-admin',
  permissions: ['read:case', 'write:case'],
  created_at: '2026-07-13T00:00:00Z',
  is_builtin: true,
}

const CUSTOM: RolePublic = {
  id: 'r-custom',
  organisation_id: 'org-1',
  name: 'Tier 1',
  permissions: ['read:case'],
  created_at: '2026-07-13T00:00:00Z',
  is_builtin: false,
}

const ROLES: RolePublic[] = [BUILTIN, CUSTOM]

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <ProfilesPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

// Mantine's Select renders both a visible combobox input and a hidden native
// <select> for forms — both carry the aria-label — so grab the visible one.
function profileInput(): HTMLInputElement {
  return screen
    .getAllByLabelText('Profile')
    .find((el) => el.getAttribute('aria-haspopup') === 'listbox') as HTMLInputElement
}

// The role picker is a Mantine Select: click the input to open the dropdown,
// then click the option by its role name. Awaits the input so callers can pick
// a profile before the roles query has resolved.
async function selectProfile(name: string) {
  const input = (await screen.findAllByLabelText('Profile')).find(
    (el) => el.getAttribute('aria-haspopup') === 'listbox',
  ) as HTMLInputElement
  fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name }))
}

function makeHttpError(status: number, detail: string): HTTPError {
  const response = new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
  return new HTTPError(
    response,
    new Request('http://localhost/api/v1/roles/r-custom'),
    {} as never,
  )
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockImplementation(
    (url) =>
      ({
        json: () =>
          Promise.resolve(
            url === 'roles/' ? ROLES : url === 'permissions/' ? CATALOG : [],
          ),
      }) as never,
  )
  patchMock.mockReset()
  patchMock.mockReturnValue({
    json: () => Promise.resolve({ ...CUSTOM }),
  } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
  showMock.mockReset()
})
afterEach(() => cleanup())

describe('ProfilesPanel — built-in roles', () => {
  it('shows a "Built-in" badge for the selected built-in role and hides it for a custom role', async () => {
    renderPanel()
    // The picker defaults to the first role (built-in org-admin), so its badge
    // shows next to the dropdown...
    await waitFor(() =>
      expect(
        profileInput().value,
      ).toBe('org-admin'),
    )
    expect(screen.getAllByText('Built-in')).toHaveLength(1)
    // ...and switching to the custom role removes it.
    await selectProfile('Tier 1')
    expect(screen.queryByText('Built-in')).toBeNull()
  })

  it('hides the save and delete controls while a built-in role is selected but keeps its permissions viewable', async () => {
    renderPanel()
    // The first role (built-in) is selected by default.
    await waitFor(() =>
      expect(
        profileInput().value,
      ).toBe('org-admin'),
    )

    expect(screen.queryByRole('button', { name: /save profile/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete profile/i })).toBeNull()

    // Permissions stay visible, but read-only (the checkboxes are disabled).
    const readCases = screen.getByLabelText('Read cases')
    expect(readCases).toBeChecked()
    expect(readCases).toBeDisabled()
  })

  it('lets a custom role be edited (save) and deleted', async () => {
    renderPanel()
    await selectProfile('Tier 1')

    // Editing a custom role: its checkboxes are enabled; toggling one dirties
    // the form and enables Save, which PATCHes the role.
    const writeCases = screen.getByLabelText('Write cases')
    expect(writeCases).toBeEnabled()
    fireEvent.click(writeCases)

    const save = screen.getByRole('button', { name: /save profile/i })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('roles/r-custom', {
        json: { permissions: ['read:case', 'write:case'] },
      }),
    )

    // The delete affordance is present for a custom role.
    expect(screen.getByRole('button', { name: /delete profile/i })).toBeTruthy()
  })

  it('surfaces a 409 detail as a friendly error when a mutation is rejected', async () => {
    patchMock.mockReturnValue({
      json: () =>
        Promise.reject(makeHttpError(409, 'Built-in roles cannot be modified')),
    } as never)

    renderPanel()
    await selectProfile('Tier 1')

    fireEvent.click(screen.getByLabelText('Write cases'))
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() =>
      expect(showMock).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          message: 'Built-in roles cannot be modified',
        }),
      ),
    )
  })
})
