/**
 * @vitest-environment jsdom
 *
 * Component test for the case actions menu's "Run analyzers" flow: the menu item
 * opens the plugin picker, and running the chosen plugins fans out one
 * `queueObservablePluginRun` per (observable × plugin) across ALL the case's
 * observables (with force threading through), then toasts a summary. When the
 * case has no observables the item shows a friendly notice and never opens an
 * empty fan-out.
 *
 * Mocks the runnable-plugins fetcher (api.get), the observable plugin-run queue,
 * the case-observables query options, the mentionable-users query, and the
 * notifications module.
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
import { CaseSummaryCard } from './CaseSummaryCard'
import type {
  CaseDetail,
  CaseDetailObservable,
} from '#/components/Cases/caseDetails.types'
import { api } from '#/lib/api/client'
import { queueObservablePluginRun } from '#/components/Observables/observablesQueries'
import {
  caseObservablesQueryOptions,
  queueCasePluginRun,
} from '#/components/Cases/casesQueries'
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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./mentionSuggestion', () => ({
  mentionableUsersQueryOptions: () => ({
    queryKey: ['mentionable-users'],
    queryFn: () => Promise.resolve([]),
  }),
}))

vi.mock('#/components/Cases/casesQueries', async (importOriginal) => ({
  ...(await importOriginal()),
  caseObservablesQueryOptions: vi.fn(),
  queueCasePluginRun: vi.fn(),
}))

const getMock = vi.mocked(api.get)
const queueMock = vi.mocked(queueObservablePluginRun)
const caseRunMock = vi.mocked(queueCasePluginRun)
const obsQueryMock = vi.mocked(caseObservablesQueryOptions)

const PLUGINS: RunnablePlugin[] = [
  {
    id: 'p1',
    name: 'VirusTotal',
    description: 'Reputation',
    capabilities: ['enrichment'],
  },
  {
    id: 'p2',
    name: 'AbuseIPDB',
    description: 'Abuse',
    capabilities: ['enrichment'],
  },
]

const RESPONDERS: RunnablePlugin[] = [
  {
    id: 'r1',
    name: 'Mailer',
    description: 'Send email',
    capabilities: ['responder'],
  },
  {
    id: 'r2',
    name: 'BlockIP',
    description: 'Block at firewall',
    capabilities: ['responder'],
  },
]

const OBSERVABLES: CaseDetailObservable[] = [
  {
    id: 'obs-1',
    type: 'ip',
    value: '8.8.8.8',
    ioc: false,
    sighted: false,
    analysis: '-',
    added: '10:00',
    addedAt: new Date().toISOString(),
    attachment: null,
  },
  {
    id: 'obs-2',
    type: 'domain',
    value: 'evil.test',
    ioc: false,
    sighted: false,
    analysis: '-',
    added: '10:01',
    addedAt: new Date().toISOString(),
    attachment: null,
  },
]

const CASE: CaseDetail = {
  id: '#42',
  sev: 2,
  tlp: 2,
  pap: 2,
  status: { id: 1, label: 'Open', stage: 'open', color: '#3b82f6' },
  title: 'Suspicious login',
  assignee: 'analyst@example.com',
  assignees: [{ id: 'u1', email: 'analyst@example.com', isPrimary: true }],
  tags: ['finance'],
  opened: '2026-07-13',
  openedAgo: '1d ago',
  updated: null,
  updatedAgo: null,
  closed: null,
  slaDueAt: null,
  slaState: null,
  descriptionMarkdown: '',
  summary: null,
  customFields: [],
  linkedAlerts: [],
  shares: 0,
  related: [],
}

function setObservables(observables: CaseDetailObservable[]) {
  obsQueryMock.mockReturnValue({
    queryKey: ['case', '42', 'observables'],
    queryFn: () => Promise.resolve(observables),
  } as never)
}

// A query that never settles — leaves `useQuery` in the pending/loading state.
function setObservablesPending() {
  obsQueryMock.mockReturnValue({
    queryKey: ['case', '42', 'observables'],
    queryFn: () => new Promise<CaseDetailObservable[]>(() => {}),
  } as never)
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <CaseSummaryCard caseDetail={CASE} caseId={CASE.id} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

async function openRunAnalyzers() {
  fireEvent.click(screen.getByRole('button', { name: 'Case actions' }))
  const item = await screen.findByText('Run analyzers')
  fireEvent.click(item)
}

async function openRunResponders() {
  fireEvent.click(screen.getByRole('button', { name: 'Case actions' }))
  const item = await screen.findByText('Run responder')
  fireEvent.click(item)
}

beforeEach(() => {
  getMock.mockReset()
  // Capability-aware: the responder picker asks for responder plugins, the
  // analyzer picker for enrichment ones.
  getMock.mockImplementation((url) => {
    const u = String(url)
    const value = u.startsWith('case-statuses')
      ? [
          {
            id: 1,
            organisation_id: 'org',
            label: 'Open',
            stage: 'open',
            color: '#3b82f6',
            is_builtin: true,
            hidden: false,
            position: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: null,
          },
          {
            id: 3,
            organisation_id: 'org',
            label: 'Resolved',
            stage: 'closed',
            color: '#10b981',
            is_builtin: true,
            hidden: false,
            position: 2,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: null,
          },
        ]
      : u.includes('capability=responder')
        ? RESPONDERS
        : PLUGINS
    return { json: () => Promise.resolve(value) } as never
  })
  queueMock.mockReset()
  queueMock.mockResolvedValue({ id: 'run-1' } as never)
  caseRunMock.mockReset()
  caseRunMock.mockResolvedValue({ id: 'crun-1' } as never)
  vi.mocked(notifications.show).mockReset()
  setObservables(OBSERVABLES)
})
afterEach(() => cleanup())

describe('CaseSummaryCard — Run analyzers', () => {
  it('opens the plugin picker from the case actions menu', async () => {
    renderCard()
    await openRunAnalyzers()

    // Picker opened and lists runnable plugins.
    await screen.findByText('VirusTotal')
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
  })

  it('dispatches one run per (observable × selected plugin) across the case observables', async () => {
    renderCard()
    await openRunAnalyzers()
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    // 2 observables × 2 plugins = 4 dispatches.
    await waitFor(() => expect(queueMock).toHaveBeenCalledTimes(4))
    expect(queueMock).toHaveBeenCalledWith('obs-1', {
      plugin_id: 'p1',
      force: false,
    })
    expect(queueMock).toHaveBeenCalledWith('obs-1', {
      plugin_id: 'p2',
      force: false,
    })
    expect(queueMock).toHaveBeenCalledWith('obs-2', {
      plugin_id: 'p1',
      force: false,
    })
    expect(queueMock).toHaveBeenCalledWith('obs-2', {
      plugin_id: 'p2',
      force: false,
    })

    await waitFor(() => expect(notifications.show).toHaveBeenCalled())
  })

  it('threads the force flag through to every dispatch', async () => {
    renderCard()
    await openRunAnalyzers()
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /virustotal/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /force re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    // 2 observables × 1 plugin = 2 dispatches, all forced.
    await waitFor(() => expect(queueMock).toHaveBeenCalledTimes(2))
    expect(queueMock).toHaveBeenCalledWith('obs-1', {
      plugin_id: 'p1',
      force: true,
    })
    expect(queueMock).toHaveBeenCalledWith('obs-2', {
      plugin_id: 'p1',
      force: true,
    })
  })

  it('opens the picker (no false "No observables" notice) while the observables query is still pending', async () => {
    setObservablesPending()
    renderCard()
    await openRunAnalyzers()

    // Picker opened rather than short-circuiting on the transient empty data.
    await screen.findByText('VirusTotal')
    expect(notifications.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No observables to analyze' }),
    )
  })

  it('opens the report export template picker from the "Export report" menu item', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Case actions' }))
    fireEvent.click(await screen.findByText('Export report'))

    // The export dialog opened (its title references the case number).
    await screen.findByText(/Export report — case #42/i)
    expect(queueMock).not.toHaveBeenCalled()
  })

  it('shows a friendly notice and does not open an empty fan-out when the case has no observables', async () => {
    setObservables([])
    renderCard()
    await openRunAnalyzers()

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No observables to analyze' }),
      ),
    )
    // The picker never opened and nothing was dispatched.
    expect(screen.queryByText('VirusTotal')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
    expect(queueMock).not.toHaveBeenCalled()
  })
})

describe('CaseSummaryCard — Run responder', () => {
  it('opens the plugin picker with capability=responder from the case actions menu', async () => {
    renderCard()
    await openRunResponders()

    // Picker opened and lists responder-capable plugins, fetched with the
    // responder capability filter.
    await screen.findByText('Mailer')
    expect(getMock).toHaveBeenCalledWith(
      'plugins/runnable?capability=responder',
    )
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
  })

  it('dispatches one case responder run per selected plugin (not fanned over observables) and toasts a summary', async () => {
    renderCard()
    await openRunResponders()
    await screen.findByText('Mailer')

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    // 2 responders → one case-targeted call each. Responders act on the case
    // itself, so this is NOT the (observable × plugin) cross-product.
    await waitFor(() => expect(caseRunMock).toHaveBeenCalledTimes(2))
    expect(caseRunMock).toHaveBeenCalledWith('#42', {
      plugin_id: 'r1',
      force: false,
    })
    expect(caseRunMock).toHaveBeenCalledWith('#42', {
      plugin_id: 'r2',
      force: false,
    })
    // Nothing dispatched at the observable level.
    expect(queueMock).not.toHaveBeenCalled()

    await waitFor(() => expect(notifications.show).toHaveBeenCalled())
  })

  it('threads the force flag through to every responder run', async () => {
    renderCard()
    await openRunResponders()
    await screen.findByText('Mailer')

    fireEvent.click(screen.getByRole('checkbox', { name: /mailer/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /force re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(caseRunMock).toHaveBeenCalledTimes(1))
    expect(caseRunMock).toHaveBeenCalledWith('#42', {
      plugin_id: 'r1',
      force: true,
    })
  })
})
