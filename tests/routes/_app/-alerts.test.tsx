// @vitest-environment jsdom
import { AlertsPage } from '#/components/pages/AlertsPage'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import type { Alert } from '#/components/Alerts/alerts.types'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

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
})
