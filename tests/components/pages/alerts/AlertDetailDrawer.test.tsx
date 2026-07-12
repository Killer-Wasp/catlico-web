// @vitest-environment jsdom
import type { Alert } from '#/components/Alerts/alerts.types'
import { AlertDetailDrawer } from '#/components/pages/alerts/AlertDetailDrawer'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as TanStackReactRouter from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// AlertDetailDrawer calls useNavigate(); stub it so the drawer can render without
// a full router harness.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const alert: Alert = {
  id: 'AL-42',
  sev: 3,
  tlp: 2,
  title: 'Suspicious login from new ASN',
  src: 'Okta',
  tags: [],
  ageMin: 14,
  firstSeenAt: '2026-07-10T09:21:00Z',
  breach: false,
  description: 'Impossible-travel signal on an admin account.',
  observables: [],
  similarCases: [],
}

function renderDrawer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <AlertDetailDrawer
          alert={alert}
          comments={[]}
          observables={[]}
          similarCases={[]}
          linkedCases={[]}
          onClose={vi.fn()}
          onAddComment={vi.fn()}
          onRunAnalysis={vi.fn()}
        />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

// The alert drawer's Mantine components (Menu/Select/Textarea) need these jsdom
// polyfills to mount — global test-setup only provides matchMedia.
beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
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

describe('AlertDetailDrawer', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    // Both the plugin-results panel and the proposed-actions strip fetch here.
    vi.mocked(api.get).mockImplementation(
      () =>
        ({ json: async () => [] }) satisfies JsonResponse as ReturnType<
          typeof api.get
        >,
    )
  })
  afterEach(cleanup)

  test('renders the plugin results panel for the alert', async () => {
    renderDrawer()

    expect(await screen.findByText('Plugin Results')).toBeInTheDocument()
    expect(
      await screen.findByText('No plugin results yet.'),
    ).toBeInTheDocument()
  })

  test('fetches plugin results using the bare numeric alert id', async () => {
    renderDrawer()

    await screen.findByText('Plugin Results')
    const calls = vi.mocked(api.get).mock.calls.map((c) => c[0])
    // The `AL-` prefix must be stripped — the endpoint expects the numeric id.
    expect(calls).toContain('alerts/42/plugin-results')
    expect(calls).not.toContain('alerts/AL-42/plugin-results')
  })

  test('shows a Detach action for a linked alert and calls onDetach', async () => {
    const onDetach = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    render(
      <MantineProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <AlertDetailDrawer
            alert={alert}
            comments={[]}
            observables={[]}
            similarCases={[]}
            linkedCases={[
              { id: '#7', title: 'Linked case', sev: 3, status: 'Open' },
            ]}
            hideActions
            onClose={vi.fn()}
            onAddComment={vi.fn()}
            onRunAnalysis={vi.fn()}
            onDetach={onDetach}
          />
        </QueryClientProvider>
      </MantineProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /detach from case/i }),
    )
    expect(onDetach).toHaveBeenCalledWith('AL-42')
  })

  test('renders no Detach action when the alert has no linked case', async () => {
    const onDetach = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    render(
      <MantineProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <AlertDetailDrawer
            alert={alert}
            comments={[]}
            observables={[]}
            similarCases={[]}
            linkedCases={[]}
            onClose={vi.fn()}
            onAddComment={vi.fn()}
            onRunAnalysis={vi.fn()}
            onDetach={onDetach}
          />
        </QueryClientProvider>
      </MantineProvider>,
    )
    await screen.findByText('Plugin Results')
    expect(
      screen.queryByRole('button', { name: /detach from case/i }),
    ).toBeNull()
  })
})
