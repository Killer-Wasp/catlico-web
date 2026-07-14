/**
 * @vitest-environment jsdom
 *
 * Component tests for PluginVersionsTab — the plugin config drawer's Versions
 * tab (v1: view installed version + upgrade-to-latest).
 *
 * The tab fires two independent GETs:
 *   - GET plugins/{id}/versions          → installed metadata + runners
 *   - GET plugins/{id}/versions/check-latest → best-effort update check
 * and a POST plugin-runners/{runner_id}/plugins/install to trigger an upgrade.
 *
 * Stubs at the `#/lib/api/client` boundary (queryOptions closures call the real
 * fetcher, so mocking the fetcher export wouldn't intercept it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PluginVersionsTab } from './PluginVersionsTab'
import { notifications } from '@mantine/notifications'
import { api } from '#/lib/api/client'
import type {
  PluginVersionInfoPublic,
  PluginLatestCheckPublic,
} from '#/components/Plugins/plugins.types'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_BASE: '/api/v1',
}))

// Notifications render into a portal the tests don't mount — assert on `show`.
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const notifyMock = vi.mocked(notifications.show)

const INSTALLED: PluginVersionInfoPublic = {
  plugin_id: 'virustotal',
  installed_version: '1.4.2',
  installed_version_id: 'virustotal@1.4.2',
  source_type: 'github',
  source_url: 'https://github.com/catlico/vt-plugin',
  source_ref: 'main',
  commit_sha: 'abcdef1234567890',
  status: 'active',
  installed_at: '2026-07-10T12:00:00Z',
  runners: [
    { id: 'r1', name: 'Runner A', status: 'healthy', install_status: 'installed', health_status: 'ok' },
    { id: 'r2', name: 'Runner B', status: 'healthy', install_status: 'installed', health_status: 'ok' },
  ],
}

const NOT_INSTALLED: PluginVersionInfoPublic = {
  plugin_id: 'shodan',
  installed_version: null,
  installed_version_id: null,
  source_type: null,
  source_url: null,
  source_ref: null,
  commit_sha: null,
  status: null,
  installed_at: null,
  runners: [],
}

const CHECK_UNKNOWN: PluginLatestCheckPublic = {
  plugin_id: 'virustotal',
  installed_version: '1.4.2',
  latest_version: null,
  update_available: false,
  status: 'unknown',
  reason: 'no registry configured',
}

const CHECK_UPDATE: PluginLatestCheckPublic = {
  plugin_id: 'virustotal',
  installed_version: '1.4.2',
  latest_version: '1.5.0',
  update_available: true,
  status: 'update_available',
  reason: null,
}

const CHECK_UP_TO_DATE: PluginLatestCheckPublic = {
  plugin_id: 'virustotal',
  installed_version: '1.4.2',
  latest_version: '1.4.2',
  update_available: false,
  status: 'up_to_date',
  reason: null,
}

/**
 * Route the two GETs to the right fixture by URL. `versions` fixture defaults to
 * INSTALLED; `check` fixture defaults to the unknown (normal v1) state.
 */
function stubGets(
  versions: PluginVersionInfoPublic = INSTALLED,
  check: PluginLatestCheckPublic = CHECK_UNKNOWN,
) {
  getMock.mockImplementation((input) => {
    const url = String(input)
    const payload = url.endsWith('/check-latest') ? check : versions
    return { json: () => Promise.resolve(payload) } as never
  })
}

function renderTab(pluginId = 'virustotal') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <PluginVersionsTab pluginId={pluginId} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
  postMock.mockResolvedValue(undefined as never)
  notifyMock.mockReset()
  stubGets()
})
afterEach(() => cleanup())

describe('PluginVersionsTab', () => {
  it('renders the installed version and the runners it is installed on', async () => {
    renderTab()
    expect(await screen.findByText('1.4.2')).toBeInTheDocument()
    // Source repo + ref + short commit
    expect(screen.getByText('https://github.com/catlico/vt-plugin')).toBeInTheDocument()
    expect(screen.getByText(/main/)).toBeInTheDocument()
    expect(screen.getByText(/abcdef1/)).toBeInTheDocument()
    // Runner list
    expect(screen.getByText('Runner A')).toBeInTheDocument()
    expect(screen.getByText('Runner B')).toBeInTheDocument()
  })

  it('renders "Not installed" when the plugin is not installed on any runner', async () => {
    stubGets(NOT_INSTALLED, { ...CHECK_UNKNOWN, plugin_id: 'shodan', installed_version: null })
    renderTab('shodan')
    expect(await screen.findByText(/not installed/i)).toBeInTheDocument()
  })

  it('renders a muted "unavailable" state for an unknown update check (not an error)', async () => {
    stubGets(INSTALLED, CHECK_UNKNOWN)
    renderTab()
    await screen.findByText('1.4.2')
    expect(await screen.findByText(/update status unavailable/i)).toBeInTheDocument()
    // The unknown state is normal — no error and no Upgrade button.
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })

  it('shows an "Up to date" state with the latest version', async () => {
    stubGets(INSTALLED, CHECK_UP_TO_DATE)
    renderTab()
    expect(await screen.findByText(/up to date/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument()
  })

  it('shows the Upgrade button when an update is available and POSTs the install trigger per runner', async () => {
    stubGets(INSTALLED, CHECK_UPDATE)
    renderTab()

    // Latest version highlighted + Upgrade offered.
    expect(await screen.findByText(/1\.5\.0/)).toBeInTheDocument()
    const upgrade = await screen.findByRole('button', { name: /upgrade/i })
    fireEvent.click(upgrade)

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(postMock).toHaveBeenCalledWith('plugin-runners/r1/plugins/install', {
      json: {
        plugin_id: 'virustotal',
        source_url: 'https://github.com/catlico/vt-plugin',
        source_ref: 'main',
      },
    })
    expect(postMock).toHaveBeenCalledWith('plugin-runners/r2/plugins/install', {
      json: {
        plugin_id: 'virustotal',
        source_url: 'https://github.com/catlico/vt-plugin',
        source_ref: 'main',
      },
    })
  })

  it('shows an error state with a Retry button when the metadata query fails', async () => {
    getMock.mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/check-latest')) {
        return { json: () => Promise.resolve(CHECK_UNKNOWN) } as never
      }
      return { json: () => Promise.reject(new Error('boom')) } as never
    })
    renderTab()

    expect(await screen.findByText(/couldn.t load version info/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('upgrades the healthy runners even if one runner install fails, and still invalidates', async () => {
    stubGets(INSTALLED, CHECK_UPDATE)
    // r2's install rejects; r1 succeeds.
    postMock.mockImplementation((input) => {
      const url = String(input)
      return url.includes('/r2/')
        ? (Promise.reject(new Error('runner down')) as never)
        : (Promise.resolve(undefined) as never)
    })

    const { invalidateSpy } = renderTab()

    const upgrade = await screen.findByRole('button', { name: /upgrade/i })
    fireEvent.click(upgrade)

    // Both runners were attempted despite r2 failing.
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    // A partial success still repaints the versions view.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['plugins', 'detail', 'virustotal', 'versions'],
      }),
    )
    // The partial-failure summary surfaces the success count.
    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/1 of 2 runners/i) }),
      ),
    )
  })
})
