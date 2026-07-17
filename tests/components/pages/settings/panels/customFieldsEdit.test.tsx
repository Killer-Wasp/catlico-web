import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
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

type JsonResponse = { json: () => Promise<unknown> }

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

let canWrite = true
vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => canWrite,
    isSuperadmin: canWrite,
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

const field = {
  id: 4,
  name: 'severity',
  display_name: 'Severity',
  description: 'Case severity',
  field_type: 'string',
  options: ['low', 'high'],
  mandatory: false,
  organisation_id: 'origin-soc',
  created_at: '2026-07-12T00:00:00Z',
  updated_at: null,
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  canWrite = true
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items: [field], total: 1, skip: 0, limit: 100 }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({ ...field, display_name: 'Case severity level' }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
})

afterEach(cleanup)

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        {children}
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('CustomFieldsPanel edit', () => {
  test('editing a field PATCHes the mutable fields (name/type unchanged)', async () => {
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    const dialog = await screen.findByRole('dialog')
    // The name and type are shown read-only (disabled) and never sent.
    const nameInput = screen.getByLabelText(/Key \(name\)/i) as HTMLInputElement
    expect(nameInput.value).toBe('severity')
    expect(nameInput.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Display name/i), {
      target: { value: 'Case severity level' },
    })
    const save = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save changes',
    )
    fireEvent.click(save as HTMLButtonElement)

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('custom-fields/4', {
        json: {
          display_name: 'Case severity level',
          description: 'Case severity',
          options: ['low', 'high'],
          mandatory: false,
        },
      }),
    )
  })

  test('without write permission there is no Edit button', async () => {
    canWrite = false
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    await screen.findByText('Severity')
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
  })
})
