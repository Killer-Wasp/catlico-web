// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
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
import { NotificationPreferences } from '#/components/pages/settings/panels/NotificationPreferences'

type JsonResponse = { json: () => Promise<unknown> }

// Read a Switch's checked state without leaking DOM-narrowing casts into every
// assertion (the `input` type is only known at the point of the checkbox query).
function isChecked(el: HTMLElement): boolean {
  return (el as HTMLInputElement).checked
}

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn() },
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

const items = [
  {
    event_type: 'case.created',
    label: 'Case created',
    category: 'Cases',
    enabled: true,
  },
  {
    event_type: 'case.updated',
    label: 'Case updated',
    category: 'Cases',
    enabled: false,
  },
  {
    event_type: 'alert.updated',
    label: 'Alert updated',
    category: 'Alerts',
    enabled: true,
  },
]

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => ({
      items: items.map((i) =>
        i.event_type === 'case.created' ? { ...i, enabled: false } : i,
      ),
    }),
  } satisfies JsonResponse as ReturnType<typeof api.put>)
})

afterEach(cleanup)

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

describe('NotificationPreferences', () => {
  test('renders switches grouped by category with states reflecting enabled', async () => {
    render(
      <Harness>
        <NotificationPreferences />
      </Harness>,
    )

    // Category headings are data-driven from the API.
    await screen.findByText('Cases')
    expect(screen.getByText('Alerts')).toBeDefined()

    const caseCreated = await screen.findByLabelText('Case created')
    const caseUpdated = screen.getByLabelText('Case updated')
    const alertUpdated = screen.getByLabelText('Alert updated')

    expect(isChecked(caseCreated)).toBe(true)
    expect(isChecked(caseUpdated)).toBe(false)
    expect(isChecked(alertUpdated)).toBe(true)
  })

  test('toggling an enabled switch PUTs a single-key partial payload', async () => {
    render(
      <Harness>
        <NotificationPreferences />
      </Harness>,
    )

    const caseCreated = await screen.findByLabelText('Case created')
    fireEvent.click(caseCreated)

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('notifications/preferences', {
        json: { preferences: { 'case.created': false } },
      }),
    )
  })

  test('surfaces an error and does not show success when the PUT rejects', async () => {
    vi.mocked(api.put).mockReturnValue({
      json: async () => {
        throw new Error('Backend unavailable')
      },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.put>)

    render(
      <Harness>
        <NotificationPreferences />
      </Harness>,
    )

    const caseCreated = await screen.findByLabelText('Case created')
    fireEvent.click(caseCreated)

    await waitFor(() =>
      expect(
        screen.getByText('Failed to update notification preferences'),
      ).toBeDefined(),
    )

    // The mutation onSuccess never ran, so no refetch PUT-driven state applied:
    // the switch still reflects the server's original enabled=true value.
    expect(isChecked(caseCreated)).toBe(true)
  })
})
