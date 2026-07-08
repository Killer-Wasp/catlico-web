// @vitest-environment jsdom
import { Navbar } from '#/components/Navbar/Navbar'
import type { AlertsResult } from '#/components/Alerts/alertsQueries'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import type { CasesResult } from '#/components/Cases/casesQueries'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import { analyzerJobsQueryOptions } from '#/components/Connectors/connectorJobs'
import type { ObservablesResult } from '#/components/Observables/observablesQueries'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import type { TasksResult } from '#/components/Tasks/tasksQueries'
import {
  OPEN_TASK_FILTERS,
  tasksQueryOptions,
} from '#/components/Tasks/tasksQueries'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type React from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { accessibleOrganisationsQueryOptions } from '#/components/pages/settings/settingsQueries'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to?: string
    children: React.ReactNode
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/alerts' }),
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
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  })
})

function renderNavbar({
  collapsed = false,
  onToggle = () => {},
}: {
  collapsed?: boolean
  onToggle?: () => void
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  queryClient.setQueryData(alertsQueryOptions().queryKey, {
    alerts: [],
    total: 0,
  } satisfies AlertsResult)
  queryClient.setQueryData(casesQueryOptions().queryKey, {
    cases: [],
    total: 0,
  } satisfies CasesResult)
  queryClient.setQueryData(observablesQueryOptions().queryKey, {
    total: 2,
    observables: [
      {
        id: 'observable-1',
        type: 'ip',
        value: '203.0.113.47',
        flags: ['ioc'],
        tlp: 2,
        source: 'feed',
        added: '10:00',
        addedAt: '2026-07-07T10:00:00Z',
      },
      {
        id: 'observable-2',
        type: 'domain',
        value: 'login.example',
        flags: [],
        tlp: 1,
        source: '#1842',
        added: '10:05',
        addedAt: '2026-07-07T10:05:00Z',
      },
    ],
  } satisfies ObservablesResult)
  queryClient.setQueryData(connectorsQueryOptions().queryKey, [])
  queryClient.setQueryData(analyzerJobsQueryOptions().queryKey, [])
  // The navbar badge reads the server-side open-tasks count (total), not rows.
  queryClient.setQueryData(tasksQueryOptions(OPEN_TASK_FILTERS).queryKey, {
    total: 1,
    tasks: [],
  } satisfies TasksResult)
  queryClient.setQueryData(accessibleOrganisationsQueryOptions().queryKey, [
    {
      id: 'origin-soc',
      name: 'Origin SOC',
      description: '',
      timezone: 'Australia/Sydney',
      default_tlp: 2,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: null,
    },
    {
      id: 'partner-acme',
      name: 'Partner ACME',
      description: '',
      timezone: 'Australia/Sydney',
      default_tlp: 2,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: null,
    },
  ])

  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Navbar collapsed={collapsed} onToggle={onToggle} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
})

afterEach(cleanup)

describe('Navbar', () => {
  test('renders query-backed badge counts from current data instead of prototype constants', () => {
    renderNavbar()

    expect(screen.getByRole('link', { name: /Alerts\s+0/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /Cases\s+0/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /Tasks\s+1/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /Observables\s+2/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /Connectors\s+0/i })).toBeDefined()
    expect(
      screen.getByRole('link', { name: /Analyzer jobs\s+0/i }),
    ).toBeDefined()

    expect(screen.queryByRole('link', { name: /Alerts\s+10/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Tasks\s+17/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Connectors\s+12/i })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /Analyzer jobs\s+3/i }),
    ).toBeNull()
  })

  test('shows the active organisation switcher at the bottom of the nav', async () => {
    renderNavbar()

    const switcher = screen.getByRole('combobox', {
      name: 'Active organisation',
    })

    expect((switcher as HTMLInputElement).value).toBe('Origin SOC')

    fireEvent.click(switcher)
    fireEvent.click(await screen.findByRole('option', { name: 'Partner ACME' }))

    await waitFor(() =>
      expect(localStorage.getItem('catlico.orgId')).toBe('partner-acme'),
    )
  })

  test('renders collapse as a labelled nav item', () => {
    const onToggle = vi.fn()

    renderNavbar({ onToggle })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    expect(screen.getByText('Collapse navigation')).toBeDefined()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
