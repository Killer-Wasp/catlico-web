// @vitest-environment jsdom
import { ObservableDetailDrawer } from '#/components/pages/observables/ObservableDetailDrawer'
import type { Observable } from '#/components/Observables/observables.types'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const observable: Observable = {
  id: 'obs-1',
  type: 'ip',
  value: '203.0.113.47',
  flags: ['ioc'],
  tlp: 2,
  source: '#1842',
  added: '09:21',
  addedAt: '2026-07-10T09:21:00Z',
}

function renderDrawer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <ObservableDetailDrawer observable={observable} onClose={vi.fn()} />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('ObservableDetailDrawer', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    // Both the plugin-results panel and the proposed-actions strip fetch here.
    vi.mocked(api.get).mockImplementation(
      () =>
        ({ json: async () => [] }) satisfies JsonResponse as ReturnType<
          typeof api.get
        >,
    )
  })
  afterEach(cleanup)

  test('renders the plugin results panel for the observable', async () => {
    renderDrawer()

    // The panel restores the plugin-evidence surface in the observable drawer.
    expect(await screen.findByText('Plugin Results')).toBeInTheDocument()
    expect(
      await screen.findByText('No plugin results yet.'),
    ).toBeInTheDocument()
  })
})
