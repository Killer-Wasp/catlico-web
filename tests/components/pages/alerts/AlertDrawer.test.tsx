/**
 * @vitest-environment jsdom
 *
 * §4.1c drawer-completeness wiring on the connected AlertDrawer:
 *  - "Run analyzers" opens the plugin picker and dispatches one
 *    `POST /alerts/{id}/plugin-runs` per selected plugin against THIS alert
 *    (bare numeric id, force threaded through).
 *  - "Add observable" mounts the shared CreateObservableDialog targeting the
 *    alert.
 *
 * The self-fetching sub-panels (Plugin Results, TTPs, Custom fields) are stubbed
 * so the test isolates the connected wiring, not their own network deps.
 */
import { AlertDrawer } from '#/components/pages/alerts/AlertDrawer'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as TanStackReactRouter from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}))

// Isolate the connected wiring from the self-fetching panels.
vi.mock('#/components/PluginResults/PluginResultsPanel', () => ({
  PluginResultsPanel: () => null,
}))
vi.mock('#/components/pages/case-detail/TtpsPanel', () => ({
  TtpsPanel: () => null,
}))
vi.mock('#/components/pages/case-detail/CustomFieldsPanel', () => ({
  CustomFieldsPanel: () => null,
}))

type JsonResponse = { json: () => Promise<unknown> }
const json = (data: unknown) =>
  ({ json: async () => data }) satisfies JsonResponse as ReturnType<
    typeof api.get
  >

const ALERT = {
  id: 42,
  type: 'phishing',
  source: 'Okta',
  source_ref: 'evt-1',
  external_link: null,
  title: 'Suspicious login',
  description: 'Impossible travel.',
  severity: 3,
  tlp: 2,
  pap: 2,
  date: '2026-07-10T09:21:00Z',
  status: 'New',
}

const PLUGINS = [
  { id: 'p1', name: 'VirusTotal', description: 'Reputation', capabilities: ['enrichment'] },
  { id: 'p2', name: 'AbuseIPDB', description: 'Abuse', capabilities: ['enrichment'] },
]

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
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

function renderDrawer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <AlertDrawer alertId="AL-42" onClose={vi.fn()} />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation(((path: string) => {
    const p = String(path)
    if (p.startsWith('plugins/runnable')) return json(PLUGINS)
    if (p === 'alerts/42') return json(ALERT)
    if (p.includes('/comments')) return json({ items: [], total: 0, skip: 0, limit: 100 })
    if (p.includes('/observables')) return json({ items: [], total: 0, skip: 0, limit: 100 })
    return json([])
  }) as unknown as typeof api.get)
  vi.mocked(api.post).mockImplementation(
    () => json({ id: 'run-1' }),
  )
})
afterEach(cleanup)

describe('AlertDrawer — §4.1c wiring', () => {
  test('Run analyzers dispatches one alert plugin-run per selected plugin', async () => {
    renderDrawer()

    fireEvent.click(await screen.findByRole('button', { name: 'Run analyzers' }))
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /force re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() =>
      expect(
        vi.mocked(api.post).mock.calls.filter(
          (c) => c[0] === 'alerts/42/plugin-runs',
        ).length,
      ).toBe(2),
    )
    const bodies = vi
      .mocked(api.post)
      .mock.calls.filter((c) => c[0] === 'alerts/42/plugin-runs')
      .map((c) => (c[1] as { json: { plugin_id: string; force: boolean } }).json)
    expect(bodies).toContainEqual({ plugin_id: 'p1', force: true })
    expect(bodies).toContainEqual({ plugin_id: 'p2', force: true })
  })

  test('Add observable opens the shared create-observable dialog', async () => {
    renderDrawer()

    fireEvent.click(await screen.findByRole('button', { name: 'Add observable' }))
    // The dialog's IOC checkbox is unique to CreateObservableDialog.
    expect(
      await screen.findByText('IOC (indicator of compromise)'),
    ).toBeInTheDocument()
  })
})
