import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { api } from '#/lib/api/client'
import { CustomFieldsPanel } from '#/components/pages/settings/panels/CustomFieldsPanel'
import { ObservableTypesPanel } from '#/components/pages/settings/panels/ObservableTypesPanel'
import { OrganisationsPanel } from '#/components/pages/settings/panels/OrganisationsPanel'

type JsonResponse = { json: () => Promise<unknown> }

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// The gating under test reads usePermissions(); drive it directly so the test
// is isolated from the permissions query layer.
let permissions: { isSuperadmin: boolean; caps: string[] } = {
  isSuperadmin: false,
  caps: [],
}
vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (perm: string | string[]) => {
      if (permissions.isSuperadmin) return true
      const wanted = Array.isArray(perm) ? perm : [perm]
      return wanted.some((p) => permissions.caps.includes(p))
    },
    isSuperadmin: permissions.isSuperadmin,
    groups: [],
    isLoaded: true,
    isLoading: false,
  }),
}))

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
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

const observableType = { name: 'ip', is_attachment: false }
const customFieldsPayload = {
  items: [
    {
      id: 7,
      name: 'ref',
      display_name: 'Reference',
      description: '',
      field_type: 'string',
      options: [],
      mandatory: false,
      organisation_id: 'origin-soc',
      created_at: '2026-06-12T09:12:00Z',
      updated_at: null,
    },
  ],
  total: 1,
  skip: 0,
  limit: 100,
}
const orgDto = {
  id: 'origin-soc',
  name: 'Origin SOC',
  description: '',
  created_at: '2026-06-12T09:12:00Z',
  updated_at: null,
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  permissions = { isSuperadmin: false, caps: [] }
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const endpoint = String(input)
    const payloads: Record<string, unknown> = {
      'observable-types/': [observableType],
      'custom-fields/': customFieldsPayload,
      'organisations/origin-soc': orgDto,
      'organisations/': [orgDto],
    }
    return {
      json: async () => payloads[endpoint] ?? [],
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
})

afterEach(cleanup)

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('settings panel permission gating', () => {
  test('CustomFieldsPanel hides create/edit/delete without any grant', async () => {
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    await screen.findByText('Reference')
    expect(screen.queryByRole('button', { name: /add field/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
  })

  test('write:custom_field grants create/edit but NOT delete', async () => {
    permissions = { isSuperadmin: false, caps: ['write:custom_field'] }
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    await screen.findByText('Reference')
    expect(screen.getByRole('button', { name: /add field/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined()
    // Delete is now a distinct grant — not implied by write.
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
  })

  test('delete:custom_field grants delete but NOT create/edit', async () => {
    permissions = { isSuperadmin: false, caps: ['delete:custom_field'] }
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    await screen.findByText('Reference')
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /add field/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
  })

  test('ObservableTypesPanel hides create/delete for non-superadmins', async () => {
    render(
      <Harness>
        <ObservableTypesPanel />
      </Harness>,
    )
    await screen.findByText('ip')
    expect(screen.queryByRole('button', { name: /add type/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
  })

  test('ObservableTypesPanel shows create/delete for superadmins', async () => {
    permissions = { isSuperadmin: true, caps: [] }
    render(
      <Harness>
        <ObservableTypesPanel />
      </Harness>,
    )
    await screen.findByText('ip')
    expect(screen.getByRole('button', { name: /add type/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDefined()
  })

  test('OrganisationsPanel hides the create action for non-superadmins', async () => {
    render(
      <Harness>
        <OrganisationsPanel />
      </Harness>,
    )
    await waitFor(() => {
      expect(screen.getByText('Origin SOC')).toBeDefined()
    })
    expect(
      screen.queryByRole('button', { name: /new organisation/i }),
    ).toBeNull()
  })

  test('OrganisationsPanel shows the create action for superadmins', async () => {
    permissions = { isSuperadmin: true, caps: [] }
    render(
      <Harness>
        <OrganisationsPanel />
      </Harness>,
    )
    await waitFor(() => {
      expect(screen.getByText('Origin SOC')).toBeDefined()
    })
    expect(
      screen.getByRole('button', { name: /new organisation/i }),
    ).toBeDefined()
  })
})
