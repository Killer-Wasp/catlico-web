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
import { NotificationPreferencesPanel } from '#/components/pages/settings/panels/NotificationPreferencesPanel'

type JsonResponse = { json: () => Promise<unknown> }

// Read a Switch's checked/disabled state without leaking DOM-narrowing casts
// into every assertion (the `input` type is only known at the checkbox query).
function isChecked(el: HTMLElement): boolean {
  return (el as HTMLInputElement).checked
}
function isDisabled(el: HTMLElement): boolean {
  return (el as HTMLInputElement).disabled
}

// A promise whose resolution we drive from the test, so two in-flight PUTs can
// be interleaved deterministically.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

describe('NotificationPreferencesPanel', () => {
  test('renders switches grouped by category with states reflecting enabled', async () => {
    render(
      <Harness>
        <NotificationPreferencesPanel />
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
        <NotificationPreferencesPanel />
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
        <NotificationPreferencesPanel />
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

  test('concurrent toggles disable each switch independently by its own in-flight PUT', async () => {
    // Two deferred PUTs, dispatched by call order (A clicked first, B second).
    const deferredA = deferred<{ items: typeof items }>()
    const deferredB = deferred<{ items: typeof items }>()
    const deferreds = [deferredA, deferredB]
    let call = 0
    vi.mocked(api.put).mockImplementation(() => {
      const d = deferreds[call++]
      return { json: () => d.promise } satisfies JsonResponse as ReturnType<
        typeof api.put
      >
    })

    render(
      <Harness>
        <NotificationPreferencesPanel />
      </Harness>,
    )

    const caseCreated = await screen.findByLabelText('Case created')
    const alertUpdated = screen.getByLabelText('Alert updated')

    // Toggle A; it disables while its PUT is in flight, B stays interactive.
    fireEvent.click(caseCreated)
    await waitFor(() => expect(isDisabled(caseCreated)).toBe(true))
    expect(isDisabled(alertUpdated)).toBe(false)

    // Toggle B before A resolves; B disables but must NOT re-enable A.
    fireEvent.click(alertUpdated)
    await waitFor(() => expect(isDisabled(alertUpdated)).toBe(true))
    expect(isDisabled(caseCreated)).toBe(true)

    // Both fired with their own correct single-key partial bodies.
    expect(api.put).toHaveBeenNthCalledWith(1, 'notifications/preferences', {
      json: { preferences: { 'case.created': false } },
    })
    expect(api.put).toHaveBeenNthCalledWith(2, 'notifications/preferences', {
      json: { preferences: { 'alert.updated': false } },
    })

    // Resolve A only: A re-enables, B remains disabled (its PUT is still open).
    deferredA.resolve({ items })
    await waitFor(() => expect(isDisabled(caseCreated)).toBe(false))
    expect(isDisabled(alertUpdated)).toBe(true)

    // Resolve B: it re-enables too.
    deferredB.resolve({ items })
    await waitFor(() => expect(isDisabled(alertUpdated)).toBe(false))
  })
})
