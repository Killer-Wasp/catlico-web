// @vitest-environment jsdom
import { Navbar } from '#/components/Navbar/Navbar'
import type { Alert } from '#/components/Alerts/alerts.types'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import type { CasesResult } from '#/components/Cases/casesQueries'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import { analyzerJobsQueryOptions } from '#/components/Connectors/connectorJobs'
import type { Observable } from '#/components/Observables/observables.types'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import type { TasksResult } from '#/components/Tasks/tasksQueries'
import { tasksQueryOptions } from '#/components/Tasks/tasksQueries'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { beforeAll, describe, expect, test, vi } from 'vitest'

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
})

function renderNavbar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  queryClient.setQueryData(alertsQueryOptions().queryKey, [] satisfies Alert[])
  queryClient.setQueryData(casesQueryOptions().queryKey, {
    cases: [],
    total: 0,
  } satisfies CasesResult)
  queryClient.setQueryData(observablesQueryOptions().queryKey, [
    {
      id: 'observable-1',
      type: 'ip',
      value: '203.0.113.47',
      flags: ['ioc'],
      tlp: 2,
      source: 'feed',
      added: '10:00',
    },
    {
      id: 'observable-2',
      type: 'domain',
      value: 'login.example',
      flags: [],
      tlp: 1,
      source: '#1842',
      added: '10:05',
    },
  ] satisfies Observable[])
  queryClient.setQueryData(connectorsQueryOptions().queryKey, [])
  queryClient.setQueryData(analyzerJobsQueryOptions().queryKey, [])
  queryClient.setQueryData(tasksQueryOptions().queryKey, {
    total: 1,
    tasks: [
      {
        id: 'T-1842-1',
        title: 'Revoke refresh tokens',
        description: 'OAuth consent grant',
        kind: 'Contain',
        caseId: '#1842',
        caseSeverity: 'high',
        due: 'No due date',
        status: 'waiting',
      },
    ],
  } satisfies TasksResult)

  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Navbar />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

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
})
