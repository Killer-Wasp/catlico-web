/**
 * @vitest-environment jsdom
 *
 * Component tests for PluginVersionsTab — the plugin config drawer's Versions
 * tab. Since the venv redesign (WP4) it is READ-ONLY: plugins are provisioned
 * into the runner at image build, so there is no in-app install/upgrade action.
 * When the update check reports a newer version the tab shows build-time upgrade
 * guidance instead of an Upgrade button — and never POSTs an install.
 *
 * The tab fires two independent GETs:
 *   - GET plugins/{id}/versions          → installed metadata + runners
 *   - GET plugins/{id}/versions/check-latest → best-effort update check
 *
 * Stubs at the `#/lib/api/client` boundary (queryOptions closures call the real
 * fetcher, so mocking the fetcher export wouldn't intercept it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PluginVersionsTab } from '#/components/pages/plugins/PluginVersionsTab'
import { api } from '#/lib/api/client'
import type {
  PluginVersionInfoPublic,
  PluginLatestCheckPublic,
} from '#/components/Plugins/plugins.types'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_BASE: '/api/v1',
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

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
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <PluginVersionsTab pluginId={pluginId} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
  postMock.mockResolvedValue(undefined as never)
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

  it('shows read-only build-time upgrade guidance when an update is available and never POSTs an install', async () => {
    stubGets(INSTALLED, CHECK_UPDATE)
    renderTab()

    // Latest version highlighted.
    expect(await screen.findByText(/1\.5\.0/)).toBeInTheDocument()
    // No in-app Upgrade action — guidance points to the build-time CLI instead.
    expect(screen.queryByRole('button', { name: /^upgrade$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/applied at image build/i)).toBeInTheDocument()
    expect(
      screen.getByText(/plugin-runner install https:\/\/github\.com\/catlico\/vt-plugin/i),
    ).toBeInTheDocument()

    // Nothing is ever POSTed from this read-only tab.
    expect(postMock).not.toHaveBeenCalled()
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

  it('allows re-running the update check', async () => {
    stubGets(INSTALLED, CHECK_UP_TO_DATE)
    renderTab()
    await screen.findByText(/up to date/i)
    fireEvent.click(screen.getByRole('button', { name: /check for update/i }))
    // The check GET is re-issued (versions + check-latest, then check-latest again).
    expect(getMock).toHaveBeenCalled()
  })
})
