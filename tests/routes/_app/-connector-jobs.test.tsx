// @vitest-environment jsdom
import type {
  EnrichmentJobDetailDto,
  EnrichmentJobRow,
} from '#/components/Connectors/connectorJobs'
import { ConnectorJobsPage } from '#/components/pages/ConnectorJobsPage'
import { api } from '#/lib/api/client'
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
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const JOB_ID = 'd4f6a1b2-1111-2222-3333-444455556666'

const row: EnrichmentJobRow = {
  id: JOB_ID,
  observable_id: 'obs-1',
  connector_name: 'abuseipdb',
  connector_display_name: 'AbuseIPDB',
  connector_version: '1.0.0',
  data_type: 'ip',
  data: '203.0.113.47',
  status: 'success',
  verdict: 'malicious',
  error: null,
  from_cache: false,
  attempts: 1,
  queued_at: '2026-06-21T10:31:00Z',
  started_at: '2026-06-21T10:31:02Z',
  ended_at: '2026-06-21T10:31:02.800Z',
}

const detail: EnrichmentJobDetailDto = {
  ...row,
  tlp: 2,
  pap: 2,
  report: { abuse_score: 97, total_reports: 41 },
  tags: [
    {
      connector_name: 'abuseipdb',
      namespace: 'abuseipdb',
      predicate: 'score',
      value: '97%',
      level: 'malicious',
    },
  ],
  created_by: 'analyst-1',
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
        <ConnectorJobsPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)

describe('ConnectorJobsPage', () => {
  beforeAll(() => {
    vi.mocked(api.get).mockImplementation((input) => {
      const url = String(input)
      const body = url.startsWith('enrichment-jobs/')
        ? detail
        : { items: [row], total: 1, skip: 0, limit: 200 }
      return { json: async () => body } as ReturnType<typeof api.get>
    })
  })

  test('renders the org queue from the backend', async () => {
    render(<Harness />)
    expect(await screen.findByText('203.0.113.47')).toBeDefined()
    expect(screen.getByText('J-d4f6a1')).toBeDefined()
  })

  test('opens a right-side report drawer with the real analyzer payload', async () => {
    render(<Harness />)

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Report' }))[0],
    )

    const modal = await screen.findByRole('dialog', {
      name: /analysis job report/i,
    })

    expect(within(modal).getByText('Observable · ip')).toBeDefined()
    expect(within(modal).getByText('203.0.113.47')).toBeDefined()
    expect(within(modal).getByText('MALICIOUS')).toBeDefined()
    // The connector's freeform report payload is rendered key by key.
    expect(within(modal).getByText('abuse_score')).toBeDefined()
    expect(within(modal).getByText('total_reports')).toBeDefined()
    // ...and its verdict badge (taxonomy) chip.
    expect(within(modal).getByText('abuseipdb:score=97%')).toBeDefined()
  })
})
