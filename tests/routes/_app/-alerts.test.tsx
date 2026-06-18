// @vitest-environment jsdom
import { AlertsPage } from '#/components/pages/AlertsPage'
import { initialAlerts } from '#/components/Alerts/alerts.fixtures'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

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
  queryClient.setQueryData(alertsQueryOptions().queryKey, initialAlerts)
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
    expect(screen.getByRole('button', { name: 'Create case (1)' })).toBeDefined()
  })
})
