/**
 * @vitest-environment jsdom
 *
 * Component test for the observable detail drawer's file affordance. A
 * file-backed observable (non-null `attachment`) shows a chip with the filename
 * and human-readable size plus a Download button; clicking Download fetches the
 * file bytes *through the api client* (so the auth + org headers attach), wraps
 * them in a Blob and triggers an `<a download={filename}>` — the token never
 * appears in a URL. A string observable (attachment null) shows no chip.
 *
 * Mocks the api client (get → blob), URL.createObjectURL/revokeObjectURL and the
 * anchor click. PluginResultsPanel is stubbed so we don't drag in its network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ObservableDetailDrawer } from '#/components/pages/observables/ObservableDetailDrawer'
import type { Observable } from '#/components/Observables/observables.types'
import { api } from '#/lib/api/client'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
  API_BASE: '/api/v1',
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

const FILE_OBSERVABLE: Observable = {
  id: 'obs-42',
  type: 'file',
  value: 'evil.bin',
  flags: [],
  tlp: 2,
  source: 'feed',
  added: '10:00',
  addedAt: new Date().toISOString(),
  attachment: {
    filename: 'evil.bin',
    size: 2049,
    content_type: 'application/octet-stream',
  },
}

const STRING_OBSERVABLE: Observable = {
  ...FILE_OBSERVABLE,
  id: 'obs-7',
  type: 'ip',
  value: '8.8.8.8',
  attachment: null,
}

function renderDrawer(observable: Observable) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ObservableDetailDrawer observable={observable} onClose={vi.fn()} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

const createUrlSpy = vi.fn((_blob: Blob) => 'blob:mock-url')
const revokeUrlSpy = vi.fn()
let clickedAnchor: HTMLAnchorElement | null = null

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({
    blob: () =>
      Promise.resolve(
        new Blob([new Uint8Array([1, 2, 3])], {
          type: 'application/octet-stream',
        }),
      ),
    json: () => Promise.resolve([]),
  } as never)
  createUrlSpy.mockClear()
  revokeUrlSpy.mockClear()
  clickedAnchor = null
  URL.createObjectURL = createUrlSpy
  URL.revokeObjectURL = revokeUrlSpy as never
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchor = this
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ObservableDetailDrawer — file attachment', () => {
  it('shows a file chip with filename + human-readable size for a file observable', () => {
    renderDrawer(FILE_OBSERVABLE)
    // Two matches (header value + chip filename) — assert at least one exists.
    expect(screen.getAllByText('evil.bin').length).toBeGreaterThan(0)
    expect(screen.getByText('2 KB')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /download/i }),
    ).toBeTruthy()
  })

  it('downloads through the api client and triggers a blob download with the filename', async () => {
    renderDrawer(FILE_OBSERVABLE)

    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    // Fetches the file endpoint through the api client (so headers attach).
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('observables/obs-42/file'),
    )

    // Wraps the bytes in a Blob with the content type and triggers the anchor.
    await waitFor(() => expect(createUrlSpy).toHaveBeenCalled())
    const blobArg = createUrlSpy.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('application/octet-stream')

    await waitFor(() => expect(clickedAnchor).not.toBeNull())
    expect(clickedAnchor!.download).toBe('evil.bin')
    expect(clickedAnchor!.getAttribute('href')).toBe('blob:mock-url')
    // The object URL is revoked after the download is triggered (no leak).
    await waitFor(() =>
      expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-url'),
    )
  })

  it('shows no file chip for a string observable', () => {
    renderDrawer(STRING_OBSERVABLE)
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull()
  })
})
