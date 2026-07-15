// @vitest-environment jsdom
import { AlertsPage } from '#/components/pages/AlertsPage'
import {
  AlertAlreadyPromotedError,
  alertCommentsQueryOptions,
  alertObservablesQueryOptions,
  alertQueryOptions,
  alertSimilarCasesQueryOptions,
  alertTagsQueryOptions,
  alertsQueryOptions,
} from '#/components/Alerts/alertsQueries'
import type { Alert } from '#/components/Alerts/alerts.types'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { AlertDetailDrawer } from '#/components/pages/alerts/AlertDetailDrawer'
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
  within,
} from '@testing-library/react'
import { Suspense, useSyncExternalStore } from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

// Stand in for the router's URL-backed alert param. `AlertsPage` reads the open
// alert from `useParams` and opens it via `navigate`, so the mock keeps a tiny
// store that `navigate` writes and `useParams` subscribes to (via
// useSyncExternalStore, so writes re-render the page) — mirroring the real
// `/alerts/$alertId` <-> `/alerts` round trip the component relies on.
let routeParams: { alertId?: string } = {}
const paramListeners = new Set<() => void>()
function setRouteParams(next: { alertId?: string }) {
  routeParams = next
  for (const listener of paramListeners) listener()
}

const navigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    Link: ({
      children,
      onClick,
    }: {
      children: React.ReactNode
      onClick?: React.MouseEventHandler<HTMLAnchorElement>
    }) => (
      <a href="#" onClick={onClick}>
        {children}
      </a>
    ),
    useNavigate: () => navigate,
    useParams: () =>
      useSyncExternalStore(
        (onStoreChange) => {
          paramListeners.add(onStoreChange)
          return () => paramListeners.delete(onStoreChange)
        },
        () => routeParams,
      ),
    Outlet: () => null,
  }
})

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

const alerts: Alert[] = [
  {
    id: 'AL-9123',
    sev: 4,
    tlp: 3,
    title: 'Possible ransomware staging — mass file rename on FILESRV-AU02',
    src: 'CrowdStrike',
    tags: ['T1486', 'ransomware'],
    ageMin: 14,
    firstSeenAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    breach: false,
    description:
      'CrowdStrike detected >4,000 file renames with appended extension .0rgn on FILESRV-AU02 within 90 seconds, initiated by svchost.exe spawned from an unsigned binary in C:\\PerfLogs\\. Shadow copies deletion attempted (blocked).',
    observables: [
      { type: 'host', value: 'FILESRV-AU02' },
      { type: 'hash', value: '9f86d081884c7d65...' },
      { type: 'file', value: 'C:\\PerfLogs\\upd.exe' },
    ],
    similarCases: [
      {
        id: '#1841',
        title: 'Ransomware staging on FILESRV-AU02',
        sev: 4,
        status: 'Open',
      },
    ],
  },
]

const caseTemplates: CaseTemplate[] = [
  {
    id: '7',
    apiId: 7,
    slug: 'credential-playbook',
    name: 'Credential playbook',
    builtin: false,
    author: 'analyst@example.com',
    updated: '12 Jun, 10:21 am',
    description: 'Use for credential alerts.',
    prefix: '[Credential] ',
    assignee: '',
    sev: 3,
    tlp: 2,
    pap: 2,
    tags: ['identity'],
    tasks: [
      {
        title: 'Confirm scope',
        group: 'Triage',
        description: 'Check affected users.',
        assignee: '',
        dueInHours: 1,
        flagged: false,
      },
    ],
    customFields: [],
  },
]

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

type JsonResponse = {
  json: () => Promise<unknown>
}

const caseDto = {
  id: 1842,
  title: 'OAuth consent grant',
  description: 'Compromised OAuth app',
  severity: 3,
  tlp: 2,
  pap: 2,
  status: 'Open',
  flagged: false,
  assignee_id: null,
  assignee_email: null,
  tags: [],
  tasks: [],
  start_date: null,
  end_date: null,
  summary: null,
  resolution_status: null,
  impact_status: null,
  duplicate_of_case_id: null,
  merged_into: null,
  merged_from: [],
  custom_fields: {},
  created_at: '2026-06-21T01:00:00Z',
  updated_at: null,
}

function Harness() {
  // Fresh client per render so cache never leaks between tests. Prime the alerts
  // query with mock data and pin it fresh (staleTime Infinity) so the component
  // reads the cache and the real `api` client is never called from a test.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(alertsQueryOptions().queryKey, {
    alerts,
    total: alerts.length,
  })
  queryClient.setQueryData(alertQueryOptions('AL-9123').queryKey, alerts[0])
  queryClient.setQueryData(alertCommentsQueryOptions('AL-9123').queryKey, [
    {
      id: 'comment-1',
      author: 'A. Analyst',
      time: '12 Jun, 10:42',
      body: 'Triage note from case view — verifying API',
    },
  ])
  queryClient.setQueryData(alertTagsQueryOptions('AL-9123').queryKey, [
    'finance',
    'T1040',
  ])
  queryClient.setQueryData(alertObservablesQueryOptions('AL-9123').queryKey, [
    {
      id: 'obs-1',
      type: 'host',
      value: 'FILESRV-AU02',
      tlp: 2,
      ioc: true,
      sighted: false,
    },
    {
      id: 'obs-2',
      type: 'hash',
      value: '9f86d081884c7d65...',
      tlp: 2,
      ioc: true,
      sighted: false,
    },
    {
      id: 'obs-3',
      type: 'file',
      value: 'C:\\PerfLogs\\upd.exe',
      tlp: 2,
      ioc: true,
      sighted: false,
    },
  ])
  queryClient.setQueryData(
    alertSimilarCasesQueryOptions('AL-9123').queryKey,
    alerts[0]?.similarCases ?? [],
  )
  queryClient.setQueryData(caseTemplatesQueryOptions().queryKey, {
    templates: caseTemplates,
    total: caseTemplates.length,
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <Suspense fallback={null}>
          <AlertsPage />
        </Suspense>
      </MantineProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)

beforeEach(() => {
  navigate.mockReset()
  // Mirror the real router: navigating to `/alerts/$alertId` opens the drawer,
  // navigating back to `/alerts` closes it. Set fresh each test since
  // `mockReset` clears the implementation.
  setRouteParams({})
  navigate.mockImplementation((opts?: { to?: string; params?: { alertId?: string } }) => {
    if (opts?.to === '/alerts/$alertId') {
      setRouteParams({ alertId: opts.params?.alertId })
    } else if (opts?.to === '/alerts') {
      setRouteParams({})
    }
  })
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const endpoint = String(input)
    if (endpoint === 'case-templates/') {
      return {
        json: async () => ({ items: [], total: 0, skip: 0, limit: 100 }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    if (endpoint === 'alerts/filters') {
      return {
        json: async () => ({ sources: [], tag_keys: {} }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    if (endpoint === 'cases/') {
      return {
        json: async () => ({ items: [caseDto], total: 1, skip: 0, limit: 10 }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    // The drawer's TTP panel (§4.1a) lists the alert's procedures as an array.
    if (endpoint.endsWith('/procedures')) {
      return {
        json: async () => [],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    return {
      json: async () => ({}),
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({}),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ id: 1842 }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => ['finance', 'T1040', 'credential-theft'],
  } satisfies JsonResponse as ReturnType<typeof api.put>)
})

describe('AlertsPage', () => {
  test('shows fetched alert tags under each alert title in the list', async () => {
    render(<Harness />)

    const title = await screen.findByText(
      'Possible ransomware staging — mass file rename on FILESRV-AU02',
    )
    const titleCell = title.closest('td')

    expect(titleCell).toBeTruthy()
    expect(within(titleCell as HTMLElement).getByText('finance')).toBeDefined()
    expect(within(titleCell as HTMLElement).getByText('T1040')).toBeDefined()
    expect(screen.getByText('14 minutes ago')).toBeDefined()
  })

  test('opens a right-side alert detail panel when an alert row is clicked', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByText('AL-9123'))

    const drawer = await screen.findByRole('dialog', { name: /alert detail/i })

    expect(drawer).toBeDefined()
    expect(within(drawer).getByText('ALERT AL-9123')).toBeDefined()
    expect(
      within(drawer).getByText(
        'Possible ransomware staging — mass file rename on FILESRV-AU02',
      ),
    ).toBeDefined()
    expect(within(drawer).getByText('CrowdStrike')).toBeDefined()
    expect(within(drawer).getByText('crowdstrike:al-9123')).toBeDefined()
    const tagRow = within(drawer).getByTestId('alert-drawer-tags')
    expect(within(tagRow).getByText('finance')).toBeDefined()
    expect(within(tagRow).getByText('T1040')).toBeDefined()
    expect(within(drawer).getByText('finance')).toBeDefined()
    expect(within(drawer).getByText('T1040')).toBeDefined()
    expect(within(drawer).getByText('14 minutes ago')).toBeDefined()
    expect(within(drawer).getByText('C:\\PerfLogs\\upd.exe')).toBeDefined()
    expect(
      within(drawer).getByTestId('drawer-section-observables-count')
        .textContent,
    ).toBe('3')
    expect(
      within(drawer).getByTestId('drawer-section-similar-cases-count')
        .textContent,
    ).toBe('1')
    expect(
      within(drawer).getByTestId('drawer-section-comments-count').textContent,
    ).toBe('1')
    expect(within(drawer).getByText('A. Analyst')).toBeDefined()
    expect(within(drawer).getByText('12 Jun, 10:42')).toBeDefined()
    expect(
      within(drawer).getByText('Triage note from case view — verifying API'),
    ).toBeDefined()
    expect(
      within(drawer).getByRole('button', {
        name: /alert actions for al-9123/i,
      }),
    ).toBeDefined()
    expect(
      within(drawer).getByRole('button', {
        name: /create case with template/i,
      }),
    ).toBeDefined()
    const templateLink = within(drawer).getByRole('link', {
      name: /view case template/i,
    })
    expect(templateLink.getAttribute('href')).toBe('/case-templates/7')
    expect(templateLink.getAttribute('target')).toBe('_blank')
    expect(
      within(drawer).queryByRole('button', { name: /promote to case/i }),
    ).toBeNull()
  })

  test('edits alert drawer tags with the reusable tag picker', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByText('AL-9123'))
    const drawer = await screen.findByRole('dialog', { name: /alert detail/i })

    fireEvent.click(within(drawer).getByRole('button', { name: '+ add tag' }))
    fireEvent.change(within(drawer).getByRole('textbox', { name: 'Tags' }), {
      target: { value: 'credential-theft' },
    })
    fireEvent.blur(within(drawer).getByRole('textbox', { name: 'Tags' }))
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save tags' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('alerts/9123/tags', {
        json: { tags: ['finance', 'T1040', 'credential-theft'] },
      }),
    )
  })

  test('select mode keeps row clicks for selection instead of opening details', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
    fireEvent.click(await screen.findByText('AL-9123'))

    expect(screen.queryByRole('dialog', { name: /alert detail/i })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Create case (1)' }),
    ).toBeDefined()
  })

  test('dismisses an alert through the alert actions menu', async () => {
    render(<Harness />)

    fireEvent.click(
      await screen.findByRole('button', { name: /alert al-9123 actions/i }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Dismiss' }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('alerts/9123', {
        json: { status: 'Ignored' },
      }),
    )
    expect(screen.queryByText('AL-9123')).toBeNull()
  })

  test('merges an alert into a searched existing case from the drawer', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByText('AL-9123'))
    const drawer = await screen.findByRole('dialog', { name: /alert detail/i })

    fireEvent.click(
      within(drawer).getByRole('button', {
        name: /alert actions for al-9123/i,
      }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /merge into case/i }),
    )

    const modal = await screen.findByRole('dialog', {
      name: /merge alert into case/i,
    })
    expect(within(modal).getByPlaceholderText(/search cases/i)).toBeDefined()
    expect(await within(modal).findByText('OAuth consent grant')).toBeDefined()

    fireEvent.click(
      within(modal).getByRole('button', { name: /merge into #1842/i }),
    )

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('alerts/merge', {
        json: { alert_ids: [9123], target_case_id: 1842 },
      }),
    )
  })

  test('removes an alert when promotion reports it was already promoted', async () => {
    vi.mocked(api.post).mockReturnValueOnce({
      json: async () => {
        throw new AlertAlreadyPromotedError(1842)
      },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.post>)
    render(<Harness />)

    fireEvent.click(await screen.findByText('AL-9123'))
    const drawer = await screen.findByRole('dialog', { name: /alert detail/i })

    fireEvent.click(
      within(drawer).getByRole('button', {
        name: /create case with template/i,
      }),
    )

    await waitFor(() => expect(screen.queryByText('AL-9123')).toBeNull())
    expect(screen.queryByRole('dialog', { name: /alert detail/i })).toBeNull()
  })

  test('closes the alert drawer when a similar case link changes page', async () => {
    render(<Harness />)

    fireEvent.click(await screen.findByText('AL-9123'))
    const drawer = await screen.findByRole('dialog', { name: /alert detail/i })

    fireEvent.click(
      within(drawer).getByText('Ransomware staging on FILESRV-AU02'),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /alert detail/i }),
      ).toBeNull(),
    )
  })

  test('hides the drawer action menu when actions are disabled', () => {
    // The drawer embeds the Plugin Results panel (useQuery-backed), so it needs
    // a QueryClientProvider even for this actions-only assertion.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <AlertDetailDrawer
            alert={alerts[0] ?? null}
            comments={[]}
            onClose={vi.fn()}
            onAddComment={vi.fn()}
            onRunAnalysis={vi.fn()}
            hideActions
          />
        </QueryClientProvider>
      </MantineProvider>,
    )

    expect(screen.queryByRole('button', { name: /alert actions/i })).toBeNull()
  })
})
