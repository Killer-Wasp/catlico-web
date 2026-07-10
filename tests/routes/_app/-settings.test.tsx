// @vitest-environment jsdom
import { OrganisationsPage } from '#/components/pages/OrganisationsPage'
import {
  SettingsLayout,
  SettingsSectionPanel,
} from '#/components/pages/SettingsPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

type JsonResponse = { json: () => Promise<unknown> }

const orgDto = {
  id: 'origin-soc',
  name: 'Backend SOC',
  description: 'Primary backend tenant',
  timezone: 'UTC',
  default_tlp: 2,
  created_at: '2026-06-12T09:12:00Z',
  updated_at: null,
}

const roleDto = {
  id: 'role-analyst',
  name: 'analyst',
  permissions: ['read:case', 'write:case', 'read:custom_field'],
  created_at: '2026-06-12T09:12:00Z',
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

// The settings page is route-driven: the tab lives in the URL as
// `/settings/$section`, so tests exercise it through a memory router that
// mirrors the real `settings` layout + `$section` child route.
function makeRouter(initialSection = 'organisation') {
  const rootRoute = createRootRoute()
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'settings',
    component: SettingsLayout,
  })
  const indexRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/',
    beforeLoad: () => {
      throw redirect({
        to: '/settings/$section',
        params: { section: 'organisation' },
      })
    },
  })
  const sectionRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '$section',
    component: SettingsSectionPanel,
  })
  const routeTree = rootRoute.addChildren([
    settingsRoute.addChildren([indexRoute, sectionRoute]),
  ])
  return createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/settings/${initialSection}`],
    }),
  })
}

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = makeRouter()
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <RouterProvider router={router} />
      </MantineProvider>
    </QueryClientProvider>
  )
}

// Organisations moved out of Settings onto its own superadmin-only page
// (/organisations). The panel is unchanged, so it's exercised directly here —
// it uses React Query but no router hooks.
function OrgHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <OrganisationsPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const endpoint = String(input)
    const payloads: Record<string, unknown> = {
      'organisations/origin-soc': orgDto,
      'organisations/': [orgDto],
      'organisations/origin-soc/members': [
        {
          id: 'membership-1',
          user_id: 'user-1',
          organisation_id: 'origin-soc',
          role_id: 'role-analyst',
          email: 'analyst@example.test',
          first_name: 'Ada',
          last_name: 'Lovelace',
          has_avatar: false,
          created_at: '2026-06-12T09:12:00Z',
        },
      ],
      'roles/': [roleDto],
      'custom-fields/': {
        items: [
          {
            id: 4,
            name: 'backend_case_reference',
            display_name: 'Backend case reference',
            description: '',
            field_type: 'string',
            options: [],
            mandatory: true,
            organisation_id: 'origin-soc',
            created_at: '2026-06-12T09:12:00Z',
            updated_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 100,
      },
      plugins: [],
      'api-keys/': [],
      'sla-policies/': {
        items: [],
        total: 0,
        skip: 0,
        limit: 100,
      },
    }
    return {
      json: async () => payloads[endpoint] ?? [],
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({
      ...orgDto,
      name: 'Updated Backend SOC',
      description: 'Updated description',
      updated_at: '2026-06-12T10:12:00Z',
    }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({
      id: 'key-1',
      name: 'splunk-forwarder',
      prefix: 'catlico',
      last_four: '1234',
      scopes: [],
      last_used_at: null,
      expires_at: null,
      organisation_id: 'origin-soc',
      created_at: '2026-06-12T10:12:00Z',
      key: 'catlico_live_secret_1234',
    }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => [],
  } satisfies JsonResponse as ReturnType<typeof api.put>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
})

afterEach(cleanup)

function fieldValue(label: string) {
  const field = screen
    .getAllByLabelText(label)
    .find((element) => element instanceof HTMLInputElement)

  expect(field).toBeDefined()
  return (field as HTMLInputElement).value
}

describe('SettingsPage', () => {
  test('loads organisation profile settings from the backend', async () => {
    render(<Harness />)

    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeDefined()
    expect(
      screen.getByRole('navigation', { name: /settings sections/i }),
    ).toBeDefined()
    expect(await screen.findByDisplayValue('Backend SOC')).toBeDefined()
    expect(fieldValue('Organisation ID')).toBe('origin-soc')
    expect(screen.getByDisplayValue('Primary backend tenant')).toBeDefined()
    expect(api.get).toHaveBeenCalledWith('organisations/origin-soc')

    fireEvent.mouseDown(screen.getByLabelText('Timezone'))
    expect(await screen.findByText('Pacific/Auckland')).toBeDefined()
  })

  test('saves organisation profile changes to the backend', async () => {
    render(<Harness />)

    const name = await screen.findByLabelText('Organisation name')
    fireEvent.change(name, { target: { value: 'Updated Backend SOC' } })
    fireEvent.change(screen.getByLabelText('Organisation description'), {
      target: { value: 'Updated description' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('organisations/origin-soc', {
        json: {
          name: 'Updated Backend SOC',
          description: 'Updated description',
          timezone: 'UTC',
          default_tlp: 2,
        },
      }),
    )
  })

  test('renders backend-backed members, roles, custom fields, and connectors', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Users & roles' }))
    expect(await screen.findByText('analyst@example.test')).toBeDefined()
    expect(screen.getByText('Ada Lovelace')).toBeDefined()
    expect(screen.getByText('ANALYST')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add User' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: /member actions for ada lovelace/i }),
    ).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: 'Profiles & permissions' }))
    expect(await screen.findByRole('button', { name: 'analyst' })).toBeDefined()
    expect(screen.getByText(/3 effective permissions/i)).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: 'Custom fields' }))
    expect(await screen.findByText('Backend case reference')).toBeDefined()
    expect(screen.getByText('backend_case_reference')).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: 'Connectors' }))
    expect(await screen.findByText(/have been replaced by the new Plugins system/)).toBeDefined()
  })

  test('creates, manages, and deletes organisations from the Organisations page', async () => {
    render(<OrgHarness />)

    expect(await screen.findByText('Backend SOC')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '+ New organisation' }))
    fireEvent.change(await screen.findByLabelText('New organisation name'), {
      target: { value: 'Managed Partner - Acme' },
    })
    expect(fieldValue('New Organisation ID')).toBe('managed-partner-acme')
    fireEvent.change(screen.getByLabelText('New organisation description'), {
      target: { value: 'External partner' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create organisation' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('organisations/', {
        json: {
          id: 'managed-partner-acme',
          name: 'Managed Partner - Acme',
          description: 'External partner',
        },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }))
    fireEvent.change(await screen.findByLabelText('Manage organisation name'), {
      target: { value: 'Updated Backend SOC' },
    })
    fireEvent.change(screen.getByLabelText('Manage organisation description'), {
      target: { value: 'Updated description' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save organisation' }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        'organisations/origin-soc',
        expect.objectContaining({
          json: expect.objectContaining({
            name: 'Updated Backend SOC',
            description: 'Updated description',
          }),
        }),
      ),
    )

    expect(fieldValue('Manage Organisation ID')).toBe('origin-soc')
    fireEvent.click(screen.getByRole('button', { name: 'Delete organisation' }))
    const deleteModal = await screen.findByRole('dialog', {
      name: /delete organisation/i,
    })
    expect(
      within(deleteModal).getByText(/type Updated Backend SOC to confirm/i),
    ).toBeDefined()
    fireEvent.change(within(deleteModal).getByLabelText('Organisation name'), {
      target: { value: 'Updated Backend SOC' },
    })
    fireEvent.click(
      within(deleteModal).getByRole('button', { name: 'Delete organisation' }),
    )
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('organisations/origin-soc'),
    )
  })

  test('shows the generated API key once in a disabled input with copy action', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByRole('tab', { name: 'API keys' }))
    fireEvent.click(await screen.findByRole('button', { name: '+ Generate key' }))
    fireEvent.change(await screen.findByLabelText('Key name'), {
      target: { value: 'splunk-forwarder' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    const modal = await screen.findByRole('dialog', { name: /api key created/i })
    const keyInput = within(modal).getByDisplayValue('catlico_live_secret_1234')
    expect((keyInput as HTMLInputElement).disabled).toBe(true)
    expect(within(modal).getByRole('button', { name: /copy api key/i })).toBeDefined()
  })

  test('shows an add SLA policy action when no policies exist', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByRole('tab', { name: 'SLA policies' }))

    expect(
      await screen.findByRole('button', { name: 'Add SLA policy' }),
    ).toBeDefined()
  })
})
