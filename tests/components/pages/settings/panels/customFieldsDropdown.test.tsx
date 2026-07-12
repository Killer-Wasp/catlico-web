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

// Grant write so the create controls render.
vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isSuperadmin: true,
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

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation(
    () =>
      ({
        json: async () => ({ items: [], total: 0, skip: 0, limit: 100 }),
      }) satisfies JsonResponse as ReturnType<typeof api.get>,
  )
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({
      id: 9,
      name: 'severity',
      display_name: 'Severity',
      description: '',
      field_type: 'string',
      options: ['low', 'high'],
      mandatory: false,
      organisation_id: 'origin-soc',
      created_at: '2026-07-12T00:00:00Z',
      updated_at: null,
    }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
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

describe('CustomFieldsPanel dropdown options', () => {
  test('the options editor shows for the default string field type', async () => {
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /add field/i }))
    await screen.findByRole('dialog')

    // Default type is string → options editor present.
    expect(screen.getByText('Dropdown options')).toBeDefined()
    expect(
      screen.getByPlaceholderText('Type a value and press Enter'),
    ).toBeDefined()
  })

  test('creating a string field with options sends them as a dropdown', async () => {
    render(
      <Harness>
        <CustomFieldsPanel />
      </Harness>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /add field/i }))
    await screen.findByRole('dialog')

    // The required label carries an asterisk, so match with a regex.
    fireEvent.change(screen.getByLabelText(/Key \(name\)/i), {
      target: { value: 'severity' },
    })

    const optionsInput = screen.getByPlaceholderText(
      'Type a value and press Enter',
    )
    fireEvent.change(optionsInput, { target: { value: 'low' } })
    fireEvent.keyDown(optionsInput, { key: 'Enter' })
    fireEvent.change(optionsInput, { target: { value: 'high' } })
    fireEvent.keyDown(optionsInput, { key: 'Enter' })

    fireEvent.click(screen.getByRole('button', { name: /create field/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('custom-fields/', {
        json: {
          name: 'severity',
          display_name: 'severity',
          description: '',
          field_type: 'string',
          options: ['low', 'high'],
          mandatory: false,
        },
      }),
    )
  })
})
