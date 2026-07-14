/**
 * @vitest-environment jsdom
 *
 * Component test for the observable detail drawer's "Run analyzers" flow: the
 * button opens the picker, and running the chosen plugins dispatches one
 * `queueObservablePluginRun` per plugin for THIS observable (with force), then
 * toasts a summary.
 *
 * Mocks the runnable-plugins fetcher, the observable plugin-run fetcher, and the
 * notifications module. PluginResultsPanel is stubbed so we don't drag in its
 * own network dependency.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ObservableDetailDrawer } from './ObservableDetailDrawer'
import type { Observable } from '#/components/Observables/observables.types'
import { api } from '#/lib/api/client'
import { queueObservablePluginRun } from '#/components/Observables/observablesQueries'
import { notifications } from '@mantine/notifications'
import type { RunnablePlugin } from '#/components/Plugins/plugins.types'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('#/components/Observables/observablesQueries', () => ({
  queueObservablePluginRun: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('#/components/PluginResults/PluginResultsPanel', () => ({
  PluginResultsPanel: () => null,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const getMock = vi.mocked(api.get)
const queueMock = vi.mocked(queueObservablePluginRun)

const PLUGINS: RunnablePlugin[] = [
  { id: 'p1', name: 'VirusTotal', description: 'Reputation', capabilities: ['enrichment'] },
  { id: 'p2', name: 'AbuseIPDB', description: 'Abuse', capabilities: ['enrichment'] },
]

const OBSERVABLE: Observable = {
  id: 'obs-42',
  type: 'ip',
  value: '8.8.8.8',
  flags: [],
  tlp: 2,
  source: 'feed',
  added: '10:00',
  addedAt: new Date().toISOString(),
}

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ObservableDetailDrawer observable={OBSERVABLE} onClose={vi.fn()} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({ json: () => Promise.resolve(PLUGINS) } as never)
  queueMock.mockReset()
  queueMock.mockResolvedValue({ id: 'run-1' } as never)
  vi.mocked(notifications.show).mockReset()
})
afterEach(() => cleanup())

describe('ObservableDetailDrawer — Run analyzers', () => {
  it('opens the picker and dispatches one run per selected plugin for this observable', async () => {
    renderDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Run analyzers' }))

    // Picker opens and lists runnable plugins.
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(queueMock).toHaveBeenCalledTimes(2))
    expect(queueMock).toHaveBeenCalledWith('obs-42', { plugin_id: 'p1', force: false })
    expect(queueMock).toHaveBeenCalledWith('obs-42', { plugin_id: 'p2', force: false })

    await waitFor(() => expect(notifications.show).toHaveBeenCalledTimes(1))
  })

  it('threads the force flag through to each dispatch', async () => {
    renderDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Run analyzers' }))
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /virustotal/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /force re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(queueMock).toHaveBeenCalledTimes(1))
    expect(queueMock).toHaveBeenCalledWith('obs-42', { plugin_id: 'p1', force: true })
  })
})
