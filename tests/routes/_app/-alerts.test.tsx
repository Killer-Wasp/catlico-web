// @vitest-environment jsdom
import { AlertsPage } from '#/components/pages/AlertsPage'
import {
  AlertAlreadyPromotedError,
  alertsQueryOptions,
} from '#/components/Alerts/alertsQueries'
import type { Alert } from '#/components/Alerts/alerts.types'
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
import { Suspense } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
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
        status: 'Open',
      },
    ],
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
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
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
})

describe('AlertsPage', () => {
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
    expect(within(drawer).getByText('C:\\PerfLogs\\upd.exe')).toBeDefined()
    expect(
      within(drawer).getByRole('button', { name: /promote to case/i }),
    ).toBeDefined()
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
      within(drawer).getByRole('button', { name: /merge into case/i }),
    )

    const modal = await screen.findByRole('dialog', {
      name: /merge alert into case/i,
    })
    expect(within(modal).getByPlaceholderText(/search cases/i)).toBeDefined()
    expect(await within(modal).findByText('OAuth consent grant')).toBeDefined()

    fireEvent.click(within(modal).getByRole('button', { name: /merge into #1842/i }))

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
      within(drawer).getByRole('button', { name: /promote to case/i }),
    )

    await waitFor(() => expect(screen.queryByText('AL-9123')).toBeNull())
    expect(screen.queryByRole('dialog', { name: /alert detail/i })).toBeNull()
  })
})
