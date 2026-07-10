// @vitest-environment jsdom
import { PluginResultsPanel } from '#/components/PluginResults/PluginResultsPanel'
import type { PluginResultPublic } from '#/components/PluginResults/pluginResults.types'
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
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }
type BlobResponse = { blob: () => Promise<Blob> }

function dto(overrides: Partial<PluginResultPublic> = {}): PluginResultPublic {
  return {
    id: 'res-1',
    plugin_run_id: 'run-1',
    organisation_id: 'org-1',
    plugin_id: 'virustotal',
    plugin_version_id: 'v1',
    entity_type: 'observable',
    entity_id: 'obs-1',
    source: 'virustotal',
    verdict: 'malicious',
    confidence: 0.92,
    render_mode: 'json',
    title: 'VT lookup',
    summary: '12 / 93 engines flagged this',
    normalized_data: { positives: 12, total: 93 },
    result_metadata: null,
    attachments: [],
    fingerprint: 'fp-1',
    expires_at: null,
    created_at: '2026-07-10T10:00:00Z',
    stale: false,
    latest: true,
    raw_data: { vendor: 'RAWSECRET' },
    ...overrides,
  }
}

/** Route the shared `api.get` mock by URL: results vs the proposed-actions strip. */
function mockApi(results: PluginResultPublic[]) {
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    const body = url.includes('plugin-results') ? results : []
    return { json: async () => body } satisfies JsonResponse as ReturnType<
      typeof api.get
    >
  })
}

/**
 * Like `mockApi`, but attachment-file requests (`.../files/...`) resolve to
 * `download` (a Blob) or reject with `downloadError` to exercise the failure
 * path. The list route still serves `results` via `.json()`.
 */
function mockApiWithDownload(
  results: PluginResultPublic[],
  { download, downloadError }: { download?: Blob; downloadError?: Error } = {},
) {
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    if (url.includes('/files/')) {
      return {
        blob: async () => {
          if (downloadError) throw downloadError
          return download ?? new Blob(['data'])
        },
      } satisfies BlobResponse as ReturnType<typeof api.get>
    }
    const body = url.includes('plugin-results') ? results : []
    return { json: async () => body } satisfies JsonResponse as ReturnType<
      typeof api.get
    >
  })
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <PluginResultsPanel entityType="observable" entityId="obs-1" />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

const rawMatcher = (content: string) => content.includes('RAWSECRET')

describe('PluginResultsPanel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    // jsdom implements neither object-URL method; the download helper needs both.
    // Assign directly (don't replace `URL`, ky relies on its constructor).
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    // Anchor.click() would trigger a jsdom "navigation not implemented" warning.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test('surfaces verdict, confidence and summary', async () => {
    mockApi([dto()])
    renderPanel()

    expect(await screen.findByText('malicious')).toBeInTheDocument()
    expect(screen.getByText('conf 92%')).toBeInTheDocument()
    expect(
      screen.getByText('12 / 93 engines flagged this'),
    ).toBeInTheDocument()
    expect(screen.getByText('VT lookup')).toBeInTheDocument()
  })

  test('groups by plugin', async () => {
    mockApi([
      dto({ id: 'r1', plugin_id: 'virustotal', source: 'vt-community' }),
      dto({ id: 'r2', plugin_id: 'geoip', source: 'maxmind', verdict: 'info' }),
    ])
    renderPanel()

    // Group headers carry the plugin id; sources are rendered separately.
    expect(await screen.findByText('virustotal')).toBeInTheDocument()
    expect(screen.getByText('geoip')).toBeInTheDocument()
    expect(screen.getByText('vt-community')).toBeInTheDocument()
    expect(screen.getByText('maxmind')).toBeInTheDocument()
  })

  test('collapses raw data behind an expand', async () => {
    mockApi([dto()])
    renderPanel()

    const toggle = await screen.findByText('Raw data')
    // Behind an expand: not visible before clicking (if mounted at all).
    const before = screen.queryByText(rawMatcher)
    if (before) expect(before).not.toBeVisible()

    fireEvent.click(toggle)

    await waitFor(() =>
      expect(screen.getByText(rawMatcher)).toBeVisible(),
    )
  })

  test('flags stale results', async () => {
    mockApi([dto({ stale: true })])
    renderPanel()

    expect(await screen.findByText('stale')).toBeInTheDocument()
  })

  test('shows an empty state when there are no results', async () => {
    mockApi([])
    renderPanel()

    expect(await screen.findByText('No plugin results yet.')).toBeInTheDocument()
  })

  test('renders an attachment chip as an actionable download and requests the entity file route', async () => {
    mockApiWithDownload([
      dto({
        attachments: [
          {
            file_ref: 'plugin-run-file:abc123',
            filename: 'screenshot.png',
            content_type: 'image/png',
            size: 2048,
            sha256: 'abc',
          },
        ],
      }),
    ])
    renderPanel()

    const chip = await screen.findByRole('button', {
      name: 'Download screenshot.png',
    })
    // Keeps the filename + human-readable size display.
    expect(chip.textContent).toContain('screenshot.png')
    expect(chip.textContent).toContain('2.0 KB')

    fireEvent.click(chip)

    // Hits the download route for THIS entity, with the file_ref's `:`
    // percent-encoded (no `/` in this ref, so nothing else is encoded).
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        'observables/obs-1/plugin-results/files/plugin-run-file%3Aabc123',
      ),
    )
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  test('encodes a file_ref that contains a slash as path segments', async () => {
    mockApiWithDownload([
      dto({
        attachments: [
          {
            file_ref: 'plugin-run-file:abc/def',
            filename: 'nested.bin',
            content_type: 'application/octet-stream',
            size: 10,
            sha256: 'h',
          },
        ],
      }),
    ])
    renderPanel()

    const chip = await screen.findByRole('button', {
      name: 'Download nested.bin',
    })
    fireEvent.click(chip)

    // `:` is percent-encoded within each segment; the `/` survives as a literal
    // path separator (the route param is a Starlette `:path`).
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        'observables/obs-1/plugin-results/files/plugin-run-file%3Aabc/def',
      ),
    )
  })

  test('surfaces an error when a download fails', async () => {
    mockApiWithDownload(
      [
        dto({
          attachments: [
            {
              file_ref: 'plugin-run-file:denied',
              filename: 'secret.bin',
              content_type: 'application/octet-stream',
              size: 4,
              sha256: 'h',
            },
          ],
        }),
      ],
      { downloadError: new Error('403 Forbidden') },
    )
    renderPanel()

    const chip = await screen.findByRole('button', {
      name: 'Download secret.bin',
    })
    fireEvent.click(chip)

    // Failure is surfaced to the user, not swallowed. No object URL created.
    expect(await screen.findByText('Download failed')).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
