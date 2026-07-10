// @vitest-environment jsdom
import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { DetailsPanel } from '#/components/pages/case-detail/DetailsPanel'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// CaseDescription mounts a Tiptap editor, which is heavy and irrelevant here.
// Stub it so the test isolates the plugin-results mount on the case detail tab.
vi.mock('#/components/pages/case-detail/CaseDescription', () => ({
  CaseDescription: () => null,
}))

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const caseDetail: CaseDetail = {
  id: '#42',
  sev: 3,
  tlp: 2,
  pap: 2,
  status: 'open',
  statusName: 'Open',
  title: 'Credential stuffing campaign',
  assignee: 'analyst@example.com',
  tags: [],
  opened: '2026-07-10',
  openedAgo: '2h ago',
  updated: null,
  updatedAgo: null,
  closed: null,
  sla: 'within',
  descriptionMarkdown: '',
  summary: null,
  customFields: [],
  linkedAlerts: [],
  shares: 0,
  responders: [],
  related: [],
  ttps: [],
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <DetailsPanel caseDetail={caseDetail} caseId="42" />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('DetailsPanel', () => {
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

  test('renders the plugin results panel for the case', async () => {
    renderPanel()

    expect(await screen.findByText('Plugin Results')).toBeInTheDocument()
    expect(
      await screen.findByText('No plugin results yet.'),
    ).toBeInTheDocument()
  })

  test('fetches plugin results using the bare numeric case id', async () => {
    renderPanel()

    await screen.findByText('Plugin Results')
    const calls = vi.mocked(api.get).mock.calls.map((c) => c[0])
    expect(calls).toContain('cases/42/plugin-results')
    expect(calls).not.toContain('cases/#42/plugin-results')
  })
})
