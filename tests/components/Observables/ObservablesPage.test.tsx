// @vitest-environment jsdom
import { ObservablesPage } from '#/components/pages/ObservablesPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 100,
})

const observableItems = [
  {
    id: 'obs-1',
    case_id: 1842,
    alert_id: null,
    observable_type: 'domain',
    data: 'login-paylink.support',
    message: 'VT 12/93',
    tlp: 2,
    ioc: true,
    sighted: true,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: null,
  },
  {
    id: 'obs-2',
    case_id: 1842,
    alert_id: null,
    observable_type: 'url',
    data: 'hxxps://cdn-au-billing[.]net/invoice.php',
    message: 'URLscan ✓',
    tlp: 2,
    ioc: true,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T09:21:00Z',
    updated_at: null,
  },
  {
    id: 'obs-3',
    case_id: 1842,
    alert_id: null,
    observable_type: 'mail',
    data: 'accounts@billing-paylink.co',
    message: '',
    tlp: 2,
    ioc: true,
    sighted: true,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T09:24:00Z',
    updated_at: null,
  },
  {
    id: 'obs-4',
    case_id: 1842,
    alert_id: null,
    observable_type: 'ip',
    data: '203.0.113.47',
    message: 'AbuseIPDB 97%',
    tlp: 2,
    ioc: true,
    sighted: true,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T09:30:00Z',
    updated_at: null,
  },
  {
    id: 'obs-5',
    case_id: 1842,
    alert_id: null,
    observable_type: 'other',
    data: 'app_id 7f3c…91ab',
    message: '',
    tlp: 2,
    ioc: false,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T09:33:00Z',
    updated_at: null,
  },
  {
    id: 'obs-6',
    case_id: null,
    alert_id: null,
    observable_type: 'hash',
    data: 'e3b0c44298fc1c149afbf4c8996fb924…',
    message: '',
    tlp: 1,
    ioc: true,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T10:21:00Z',
    updated_at: null,
  },
  {
    id: 'obs-7',
    case_id: 1841,
    alert_id: null,
    observable_type: 'ip',
    data: '198.51.100.22',
    message: 'GreyNoise noise',
    tlp: 1,
    ioc: true,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T10:24:00Z',
    updated_at: null,
  },
  {
    id: 'obs-8',
    case_id: 1842,
    alert_id: null,
    observable_type: 'file',
    data: 'invoice_872144.pdf',
    message: '',
    tlp: 2,
    ioc: false,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T10:31:00Z',
    updated_at: null,
  },
]

const enrichmentOverview = {
  jobs: [
    {
      id: 'job-1',
      observable_id: 'obs-4',
      connector_name: 'abuseipdb',
      connector_version: '1.0.0',
      status: 'success',
      verdict: 'malicious',
      error: null,
      from_cache: false,
      queued_at: '2026-06-12T10:31:00Z',
      ended_at: '2026-06-12T10:31:02Z',
    },
  ],
  tags: [
    {
      connector_name: 'abuseipdb',
      namespace: 'AbuseIPDB',
      predicate: 'abuse-score',
      value: '97%',
      level: 'malicious',
    },
  ],
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

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <ObservablesPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

// Server-side filtering is simulated here: the mock applies the `type` clause
// the UI tests exercise (category → raw observable_type), so the page renders
// the filtered page the "backend" would have returned.
const TYPE_RAWS = {
  domain: ['domain'],
  url: ['url'],
  mail: ['mail', 'email'],
  ip: ['ip', 'ipv4', 'ipv6'],
  hash: ['hash'],
  file: ['file', 'filename'],
} as const
const KNOWN_RAWS = new Set<string>(Object.values(TYPE_RAWS).flat())

function isObservableCategory(value: string): value is keyof typeof TYPE_RAWS {
  return Object.hasOwn(TYPE_RAWS, value)
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({}),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.get).mockImplementation((input, options) => {
    const url = String(input)
    if (url.includes('/enrichments')) {
      return {
        json: async () => enrichmentOverview,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    if (url === 'observables/filters') {
      return {
        json: async () => ({ sources: ['#1842', '#1841', 'feed'] }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    const sp = (options as { searchParams?: URLSearchParams } | undefined)
      ?.searchParams
    let items = observableItems
    for (const term of sp?.getAll('filter') ?? []) {
      const [key, , value] = term.split('~')
      if (key === 'type') {
        if (isObservableCategory(value)) {
          const raws: readonly string[] = TYPE_RAWS[value]
          items = items.filter((o) => raws.includes(o.observable_type))
        } else {
          items = items.filter((o) => !KNOWN_RAWS.has(o.observable_type))
        }
      }
    }
    return {
      json: async () => page(items),
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
})

afterEach(cleanup)

describe('ObservablesPage', () => {
  test('renders an observable table with search-bar filters, bulk actions and pagination', async () => {
    render(<Harness />)

    expect(await screen.findByText('login-paylink.support')).toBeDefined()
    expect(screen.getByText('2 hours ago')).toBeDefined()
    expect(
      screen.getByRole('button', { name: '+ Add observable' }),
    ).toBeDefined()
    expect(
      screen.getByRole('heading', { name: 'All observables' }),
    ).toBeDefined()
    expect(screen.getByText('8 observables')).toBeDefined()
    expect(
      screen.getByPlaceholderText(
        'Filter observables — pick a field, then a value',
      ),
    ).toBeDefined()
    expect(screen.getAllByLabelText('TLP:AMBER').length).toBeGreaterThan(0)
    expect(screen.getAllByText('domain').length).toBeGreaterThan(0)
    expect(screen.queryByRole('columnheader', { name: 'Flags' })).toBeNull()
    expect(screen.getByText('Note VT 12/93')).toBeDefined()
    expect(screen.getByText('1-8 of 8')).toBeDefined()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Observable login-paylink.support actions',
      }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /analyze/i }))
    expect(
      await screen.findByText('Analyzer queued for login-paylink.support'),
    ).toBeDefined()

    // Bulk actions live in select mode and start disabled with nothing selected.
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(
      screen.getByRole('button', { name: 'Run analyzers on selected' }),
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: 'Export selected to MISP' }),
    ).toHaveProperty('disabled', true)
  })

  test('enables bulk actions when an observable is selected', async () => {
    render(<Harness />)

    expect(await screen.findByText('login-paylink.support')).toBeDefined()
    // Row checkboxes only appear after entering select mode.
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select observable login-paylink.support',
      }),
    )

    expect(
      screen.getByRole('button', { name: 'Run analyzers on selected' }),
    ).toHaveProperty('disabled', false)
    expect(
      screen.getByRole('button', { name: 'Export selected to MISP' }),
    ).toHaveProperty('disabled', false)
  })

  test('filters observables by token search field', async () => {
    render(<Harness />)

    expect(await screen.findByText('login-paylink.support')).toBeDefined()
    fireEvent.click(
      screen.getByPlaceholderText(
        'Filter observables — pick a field, then a value',
      ),
    )
    fireEvent.click(screen.getByRole('option', { name: 'Type' }))
    fireEvent.click(screen.getByRole('option', { name: 'Ip' }))

    // Filtering is server-side now: wait for the refetched page to render.
    await waitFor(() =>
      expect(screen.queryByText('login-paylink.support')).toBeNull(),
    )
    expect(screen.getByText('203.0.113.47')).toBeDefined()
    expect(screen.getByText('198.51.100.22')).toBeDefined()
    expect(screen.getByText('1-2 of 2')).toBeDefined()
  })

  test('opens an observable detail modal and renders its fetched enrichment', async () => {
    render(<Harness />)

    expect(await screen.findByText('203.0.113.47')).toBeDefined()
    fireEvent.click(screen.getByText('203.0.113.47'))

    const modal = screen.getByRole('dialog', { name: /observable detail/i })

    expect(modal).toBeDefined()
    expect(screen.getByText('OBSERVABLE · ip')).toBeDefined()
    expect(screen.getAllByText('203.0.113.47').length).toBeGreaterThan(1)
    expect(screen.getByText(/properties/i)).toBeDefined()

    // Enrichment is fetched per-observable and renders the real verdict + taxonomy.
    expect(await screen.findByText('AbuseIPDB')).toBeDefined()
    expect(screen.getAllByText('MALICIOUS').length).toBeGreaterThan(0)
    expect(screen.getByText('AbuseIPDB:abuse-score=97%')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Toggle IOC' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Mark sighted' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Export to MISP' }),
    ).toHaveProperty('disabled', true)
  })

  test('updates observable flags from detail actions', async () => {
    render(<Harness />)

    expect(await screen.findByText('app_id 7f3c…91ab')).toBeDefined()
    fireEvent.click(screen.getByText('app_id 7f3c…91ab'))

    const modal = screen.getByRole('dialog', { name: /observable detail/i })
    expect(within(modal).getByText('IOC')).toBeDefined()
    expect(within(modal).getAllByText('no').length).toBeGreaterThanOrEqual(2)

    fireEvent.click(within(modal).getByRole('button', { name: 'Toggle IOC' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('observables/obs-5', {
        json: { ioc: true, sighted: false },
      }),
    )
    expect(within(modal).getByText('yes')).toBeDefined()

    fireEvent.click(within(modal).getByRole('button', { name: 'Mark sighted' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('observables/obs-5', {
        json: { ioc: true, sighted: true },
      }),
    )
    expect(within(modal).getAllByText('yes').length).toBeGreaterThanOrEqual(2)
    expect(
      within(modal).getByRole('button', { name: 'Mark sighted' }),
    ).toHaveProperty('disabled', true)
  })

  test('reruns enrichment when Run analyzers is clicked', async () => {
    render(<Harness />)

    expect(await screen.findByText('203.0.113.47')).toBeDefined()
    fireEvent.click(screen.getByText('203.0.113.47'))
    const modal = screen.getByRole('dialog', { name: /observable detail/i })
    await within(modal).findByText('AbuseIPDB')

    const enrichmentCallsBefore = vi
      .mocked(api.get)
      .mock.calls.filter(([input]) =>
        String(input).includes('/enrichments'),
      ).length

    fireEvent.click(
      within(modal).getByRole('button', { name: 'Run analyzers' }),
    )

    await waitFor(() => {
      const enrichmentCallsAfter = vi
        .mocked(api.get)
        .mock.calls.filter(([input]) =>
          String(input).includes('/enrichments'),
        ).length
      expect(enrichmentCallsAfter).toBeGreaterThan(enrichmentCallsBefore)
    })
  })

  test('shows a backend error instead of falling back to fixture observables', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      if (String(input).includes('/enrichments')) {
        return {
          json: async () => enrichmentOverview,
        } satisfies JsonResponse as ReturnType<typeof api.get>
      }
      return {
        json: async (): Promise<unknown> => {
          throw new Error('backend unavailable')
        },
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    render(<Harness />)

    expect(
      await screen.findByText('Couldn’t load observables from the backend.'),
    ).toBeDefined()
    expect(screen.queryByText('login-paylink.support')).toBeNull()
  })
})
