import { MantineProvider } from '@mantine/core'
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
import { api } from '#/lib/api/client'
import { DashboardsPage } from '#/components/pages/DashboardsPage'
import { DEFAULT_LAYOUT } from '#/components/Dashboards/widgets'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useBlocker: () => ({ status: 'idle' }) }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

// The raw snake_case overview DTO (the fetcher maps it to camelCase). Empty
// arrays keep the charts quiet in jsdom; the grid just needs it to load.
const overview = {
  generated_at: '2026-07-12T00:00:00Z',
  stats: {
    open_cases: 0,
    open_cases_delta: 0,
    new_alerts_24h: 0,
    new_alerts_delta_pct: 0,
    sla_breaches: 0,
    sla_breaches_critical: 0,
    sla_breaches_high: 0,
    mttr_hours_7d: null,
    mttr_delta_hours: null,
  },
  alerts_by_severity: [],
  open_alerts_total: 0,
  triage_queue: [],
  case_pipeline: [],
  analyst_workload: [],
  ingestion_24h: [],
  latest_observables: [],
  trend_days: 14,
  case_trend: [],
  resolution_breakdown: [],
  alerts_by_source: [],
  iocs_tracked: 0,
  cases_by_severity: [],
  sla_compliance: { met: 0, breached: 0, pct: null },
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
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    const body = url.startsWith('dashboards') ? [] : overview
    return { json: async () => body } satisfies JsonResponse as ReturnType<
      typeof api.get
    >
  })
})

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <DashboardsPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)

describe('DashboardsPage widget reorder', () => {
  test('customize mode renders drag handles alongside the a11y move buttons', async () => {
    render(<Harness />)

    // Enter customize mode (the default view is editable).
    fireEvent.click(await screen.findByRole('button', { name: /customize/i }))

    // Every widget in the default layout gets its own drag handle for
    // pointer/keyboard reordering (the chevron move buttons remain too, for a11y).
    const handles = await screen.findAllByRole('button', {
      name: /drag to reorder/i,
    })
    expect(handles.length).toBe(DEFAULT_LAYOUT.length)
  })
})
