import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { PublicDashboardPage } from '#/components/pages/PublicDashboardPage'

// The page reads publicDashboardQueryOptions(); drive its queryFn directly so we
// don't exercise the network. `publicResult` is a thunk the mock calls per test.
let publicResult: () => Promise<unknown> = async () => {
  throw new Error('not set')
}
vi.mock('#/components/Dashboards/dashboardsQueries', () => ({
  publicDashboardQueryOptions: (token: string) => ({
    queryKey: ['public-dashboard', token],
    queryFn: () => publicResult(),
    retry: false,
  }),
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
})

afterEach(cleanup)

function Harness({ token }: { token: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <PublicDashboardPage token={token} />
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('PublicDashboardPage', () => {
  test('renders the shared board read-only for a valid token', async () => {
    publicResult = async () => ({
      name: 'NOC wallboard',
      description: 'Shared with the front desk',
      layout: { widgets: [] },
      overview: { generatedAt: '2026-07-12T00:00:00Z' },
    })
    render(<Harness token="good-token" />)

    expect(await screen.findByText('NOC wallboard')).toBeDefined()
    expect(screen.getByText('Shared with the front desk')).toBeDefined()
    // The read-only marker is present; no editing chrome is rendered.
    expect(screen.getByText(/read-only shared view/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /customize/i })).toBeNull()
  })

  test('shows an unavailable message for a revoked/invalid token', async () => {
    publicResult = async () => {
      throw new Error('404')
    }
    render(<Harness token="bad-token" />)

    expect(await screen.findByText(/dashboard unavailable/i)).toBeDefined()
    expect(
      screen.getByText(/invalid or has been revoked/i),
    ).toBeDefined()
  })
})
