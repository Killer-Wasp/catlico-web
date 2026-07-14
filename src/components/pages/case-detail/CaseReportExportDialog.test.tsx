/**
 * @vitest-environment jsdom
 *
 * Component test for the case "Export report" template picker. It lists the
 * org's report templates and, on picking one, renders the report to HTML
 * *through the api client* (so the auth + org headers attach), wraps the HTML in
 * a Blob, and opens the resulting object URL in a new tab — never putting the
 * bearer token in a URL.
 *
 * Mocks the api client (get), URL.createObjectURL/revokeObjectURL, and
 * window.open.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CaseReportExportDialog } from './CaseReportExportDialog'
import { api } from '#/lib/api/client'
import type { ReportTemplatePublic } from '#/components/pages/settings/settingsQueries'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('#/lib/auth/session', () => ({
  getActiveOrgId: () => 'org-1',
  getSessionOrganisationIds: () => ['org-1'],
}))

const getMock = vi.mocked(api.get)

const TEMPLATES: ReportTemplatePublic[] = [
  {
    id: 't-1',
    name: 'Incident summary',
    description: 'Exec write-up',
    content_md: '# {{ title }}',
    config: {},
    organisation_id: 'org-1',
    created_at: '2026-07-13T00:00:00Z',
    updated_at: null,
  },
]

const HTML = '<html><body><h1>Case 42</h1></body></html>'

const onCloseSpy = vi.fn()

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <CaseReportExportDialog
          caseId="42"
          caseNumber="#42"
          opened
          onClose={onCloseSpy}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

const openSpy = vi.fn()
const createUrlSpy = vi.fn((_blob: Blob) => 'blob:mock-url')
const revokeUrlSpy = vi.fn()

beforeEach(() => {
  onCloseSpy.mockReset()
  vi.mocked(notifications.show).mockReset()
  getMock.mockReset()
  // The api client returns a thenable with both .json() (list) and .text()
  // (render) — the dialog uses .json() for the list and .text() for the render.
  getMock.mockReturnValue({
    json: () => Promise.resolve(TEMPLATES),
    text: () => Promise.resolve(HTML),
  } as never)
  openSpy.mockReset()
  // A truthy handle by default = the tab opened (not pop-up blocked).
  openSpy.mockReturnValue({})
  createUrlSpy.mockClear()
  revokeUrlSpy.mockClear()
  vi.stubGlobal('open', openSpy)
  URL.createObjectURL = createUrlSpy
  URL.revokeObjectURL = revokeUrlSpy as never
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CaseReportExportDialog', () => {
  it('lists the org report templates', async () => {
    renderDialog()
    await screen.findByText('Incident summary')
    expect(screen.getByText('Exec write-up')).toBeTruthy()
  })

  it('renders via the api client with case_id + fmt=html and opens a blob URL in a new tab', async () => {
    renderDialog()
    const item = await screen.findByText('Incident summary')

    fireEvent.click(item)

    // Fetches the render endpoint through the api client (so headers attach).
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('report-templates/t-1/render', {
        searchParams: { case_id: '42', fmt: 'html' },
      }),
    )

    // Wraps the HTML in a Blob and opens the object URL — token never in the URL.
    await waitFor(() => expect(createUrlSpy).toHaveBeenCalled())
    const blobArg = createUrlSpy.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('text/html')
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank')

    // The dialog closes itself once the tab has opened.
    await waitFor(() => expect(onCloseSpy).toHaveBeenCalled())
  })

  it('surfaces an error and keeps the dialog open when the report tab is pop-up blocked', async () => {
    // window.open returns null when the browser blocks the pop-up.
    openSpy.mockReturnValue(null)
    renderDialog()
    fireEvent.click(await screen.findByText('Incident summary'))

    // The render succeeded, so we must surface the failure ourselves.
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red' }),
      ),
    )
    // The just-created object URL is revoked immediately (no leak on the dead path).
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-url')
    // Dialog stays open so the user can retry after allowing pop-ups.
    expect(onCloseSpy).not.toHaveBeenCalled()
  })
})
