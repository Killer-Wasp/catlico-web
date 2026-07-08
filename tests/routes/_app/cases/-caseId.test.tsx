// @vitest-environment jsdom
import type {
  CaseDetail,
  CaseDetailAttachment,
  CaseDetailComment,
  CaseDetailObservable,
  CaseDetailTask,
  CaseDetailTaskLog,
  CaseDetailTimelineEvent,
} from '#/components/Cases/caseDetails.types'
import { caseKeys } from '#/components/Cases/casesQueries'
import { CaseSummaryCard } from '#/components/pages/case-detail/CaseSummaryCard'
import { CaseTabPanel } from '#/components/pages/CaseDetailPage'
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
  within,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const enrichmentOverview = {
  jobs: [
    {
      id: 'job-obs-2',
      observable_id: 'obs-2',
      connector_name: 'recordedfuture',
      connector_version: '2.7.1',
      status: 'success',
      verdict: 'suspicious',
      error: null,
      from_cache: true,
      queued_at: '2026-06-12T10:31:00Z',
      ended_at: '2026-06-12T10:31:02Z',
    },
  ],
  tags: [
    {
      connector_name: 'recordedfuture',
      namespace: 'RecordedFuture',
      predicate: 'risk-score',
      value: '89',
      level: 'suspicious',
    },
  ],
}

const caseDetail: CaseDetail = {
  id: '#1842',
  sev: 3,
  tlp: 2,
  pap: 2,
  status: 'open',
  statusName: 'Open',
  title: 'OAuth consent grant — privileged account compromise',
  assignee: 'J. Tanaka',
  tags: ['T1528', 'identity', 'bec'],
  opened: 'Today 09:12',
  openedAgo: '3h ago',
  updated: 'Today 11:40',
  updatedAgo: '32m ago',
  closed: null,
  sla: '3h 18m to SLA',
  descriptionMarkdown: 'OAuth consent grant investigation.',
  summary: 'Containment is underway.',
  customFields: [
    ['Affected users', '3'],
    ['Business unit', 'Corporate IT'],
    ['Campaign ID', 'BILL-2026-Q2'],
  ],
  linkedAlerts: [],
  shares: 0,
  responders: [],
  related: [],
  ttps: [],
}

// Each panel now fetches its own section; the harness seeds these fixtures into
// the query cache (staleTime: Infinity) so panels read them without an API call.
const tasksFixture: CaseDetailTask[] = [
  {
    id: 'T-1842-4',
    apiId: 4,
    caseId: 1842,
    title: 'Disable malicious app registration tenant-wide',
    group: 'Contain',
    status: 'inprogress',
    assignee: 'J. Tanaka',
    flagged: false,
    due: '2026-06-12T13:00:00Z',
    start: '2026-06-12T10:00:00Z',
    end: null,
    description:
      'Block the app registration and add it to the blocked apps policy.',
    logs: 1,
  },
]

// A task's work-logs load lazily when it is opened; seeded under the task-logs key.
const taskLogsFixture: CaseDetailTaskLog[] = [
  {
    id: 'wl-1842-4-1',
    apiId: 1,
    caseId: 1842,
    taskId: 4,
    author: 'J. Tanaka',
    time: '12 June, 10:08 am',
    body: 'App registration disabled in our tenant. Waiting on cross-tenant confirmation.',
    attachments: [
      {
        id: 'att-1',
        name: 'tenant-blocklist-approval.pdf',
        size: '92 KB',
      },
    ],
  },
]

const observablesFixture: CaseDetailObservable[] = [
  {
    id: 'obs-2',
    type: 'url',
    value: 'hxxps://cdn-au-billing[.]net/invoice.php',
    ioc: true,
    sighted: false,
    analysis: 'URLscan complete',
    added: '09:21',
    addedAt: '2026-06-12T09:21:00Z',
  },
]

const commentsFixture: CaseDetailComment[] = []

const attachmentsFixture: CaseDetailAttachment[] = [
  {
    id: 'attachment-1',
    linkId: 1,
    kind: 'PDF',
    name: 'tenant-blocklist-approval.pdf',
    size: '92 KB',
    sizeBytes: 94_208,
    sha256: 'abc123',
    contentType: 'application/pdf',
    author: 'J. Tanaka',
    time: '10:08',
  },
]

const timelineFixture: CaseDetailTimelineEvent[] = []

// Backend-shaped observable for the one query that gets refetched: updating a
// flag invalidates the observables list. Mirrors observablesFixture's obs-2.
const observablePageItem = {
  id: 'obs-2',
  case_id: 1842,
  alert_id: null,
  observable_type: 'url',
  data: 'hxxps://cdn-au-billing[.]net/invoice.php',
  message: 'URLscan complete',
  tlp: 2,
  ioc: true,
  sighted: false,
  ignore_similarity: false,
  organisation_id: 'org-1',
  created_at: '2026-06-12T09:21:00Z',
  updated_at: null,
}

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
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  })
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

function Harness() {
  return <CaseTabHarness tab="observables" />
}

function CaseSummaryHarness() {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <CaseSummaryCard caseDetail={caseDetail} caseId="1842" />
      </MantineProvider>
    </QueryClientProvider>
  )
}

function seededClient() {
  // staleTime: Infinity keeps the seeded panel data from refetching on mount, so
  // each panel renders synchronously from the cache in tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(caseKeys.tasks('1842'), tasksFixture)
  queryClient.setQueryData(caseKeys.taskLogs('1842', 4), taskLogsFixture)
  queryClient.setQueryData(caseKeys.observables('1842'), observablesFixture)
  queryClient.setQueryData(caseKeys.comments('1842', 'desc'), commentsFixture)
  queryClient.setQueryData(caseKeys.attachments('1842'), attachmentsFixture)
  queryClient.setQueryData(caseKeys.timeline('1842'), timelineFixture)
  return queryClient
}

function CaseTabHarness({
  tab,
}: {
  tab:
    | 'attachments'
    | 'comments'
    | 'custom-fields'
    | 'details'
    | 'observables'
    | 'sharing'
    | 'tasks'
    | 'timeline'
}) {
  return (
    <QueryClientProvider client={seededClient()}>
      <MantineProvider>
        <Notifications />
        <CaseTabPanel tab={tab} caseDetail={caseDetail} caseId="1842" />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const endpoint = String(input)
    const json = (value: unknown) =>
      ({ json: async () => value }) satisfies JsonResponse as ReturnType<
        typeof api.get
      >
    const page = (items: unknown[]) =>
      json({ items, total: items.length, skip: 0, limit: 100 })
    if (endpoint === 'observable-types/') {
      return json([
        { name: 'domain', is_attachment: false },
        { name: 'url', is_attachment: false },
        { name: 'ip', is_attachment: false },
        { name: 'mail', is_attachment: false },
        { name: 'hash', is_attachment: false },
        { name: 'file', is_attachment: true },
        { name: 'other', is_attachment: false },
      ])
    }
    // Seeded queries don't refetch on mount; these cover the refetch after a
    // flag-update invalidation and any defensive fetch.
    if (endpoint === 'cases/1842/observables') return page([observablePageItem])
    if (endpoint === 'cases/1842/tasks') return page([])
    if (endpoint === 'cases/1842/comments') return page([])
    if (endpoint === 'cases/1842/activity') return page([])
    if (endpoint === 'cases/1842/attachments') return page([])
    return json(enrichmentOverview)
  })
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({}),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({
      id: 'log-new',
      message: 'Posted',
      created_by: 'J. Tanaka',
      created_at: '2026-06-12T10:42:00Z',
      updated_at: null,
      attachments: [],
    }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => ({}),
  } satisfies JsonResponse as ReturnType<typeof api.put>)
})

afterEach(cleanup)

describe('case summary card', () => {
  test('does not render the assignee avatar inside a paragraph', () => {
    const { container } = render(<CaseSummaryHarness />)

    expect(container.querySelector('p .mantine-Avatar-root')).toBeNull()
    expect(screen.getByText('J. Tanaka')).toBeDefined()
  })

  test('groups summary actions behind a right-aligned action icon menu', async () => {
    render(<CaseSummaryHarness />)

    expect(screen.queryByRole('button', { name: /^assign$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /export report/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /close case/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /run analyzers/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /case actions/i }))

    expect(
      await screen.findByRole('menuitem', { name: /export report/i }),
    ).toBeDefined()
    expect(screen.getByText('Close case')).toBeDefined()
    expect(screen.getByText('Run analyzers')).toBeDefined()
  })

  test('moves editable tags above traffic labels and SLA', () => {
    render(<CaseSummaryHarness />)

    const trafficRow = screen.getByTestId('case-summary-traffic-row')
    const tagsRow = screen.getByTestId('case-summary-tags-row')

    expect(within(trafficRow).getByText(/tlp:/i)).toBeDefined()
    expect(within(trafficRow).getByText(/pap:/i)).toBeDefined()
    expect(within(trafficRow).getByText(caseDetail.sla)).toBeDefined()
    expect(within(tagsRow).getByText('T1528')).toBeDefined()
    expect(
      within(tagsRow)
        .getByText('identity')
        .closest('[data-tag-tone]')
        ?.getAttribute('data-size'),
    ).toBe('sm')
    expect(
      tagsRow.compareDocumentPosition(trafficRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(tagsRow).getByRole('button', { name: '+ add tag' }),
    ).toBeDefined()
  })

  test('edits case summary tags with the reusable tag picker', async () => {
    render(<CaseSummaryHarness />)

    fireEvent.click(screen.getByRole('button', { name: '+ add tag' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Tags' }), {
      target: { value: 'finance' },
    })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Tags' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save tags' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('cases/1842/tags', {
        json: { tags: ['T1528', 'identity', 'bec', 'finance'] },
      }),
    )
  })
})

describe('case observables tab', () => {
  test('places the add observable action above the table', () => {
    const { container } = render(<Harness />)

    const addButton = screen.getByRole('button', { name: /add observable/i })
    const table = container.querySelector('table')

    expect(table).not.toBeNull()
    expect(
      addButton.compareDocumentPosition(table!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test('renders observables without the old flags and analysis columns', () => {
    render(<Harness />)

    expect(
      screen.getByRole('table', { name: /case observables/i }),
    ).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Added' })).toBeDefined()
    expect(screen.queryByRole('columnheader', { name: 'Flags' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Analysis' })).toBeNull()
  })

  test('opens an observable detail drawer when an observable row is clicked', async () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByText('hxxps://cdn-au-billing[.]net/invoice.php'),
    )

    const drawer = await screen.findByRole('dialog', {
      name: /observable detail/i,
    })

    expect(within(drawer).getByText('OBSERVABLE · url')).toBeDefined()
    expect(
      within(drawer).getAllByText('hxxps://cdn-au-billing[.]net/invoice.php')
        .length,
    ).toBeGreaterThan(0)
    expect(await within(drawer).findByText('RecordedFuture')).toBeDefined()
    expect(within(drawer).getAllByText('SUSPICIOUS').length).toBeGreaterThan(0)
    expect(
      within(drawer).getByText('RecordedFuture:risk-score=89'),
    ).toBeDefined()
    expect(within(drawer).queryByText('URLscan.io')).toBeNull()
    expect(
      within(drawer).getByRole('button', { name: /export to misp/i }),
    ).toBeDefined()
    expect(api.get).toHaveBeenCalledWith('observables/obs-2/enrichments')
  })

  test('updates IOC and sighted flags from the observable detail drawer', async () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByText('hxxps://cdn-au-billing[.]net/invoice.php'),
    )

    const drawer = await screen.findByRole('dialog', {
      name: /observable detail/i,
    })

    fireEvent.click(within(drawer).getByRole('button', { name: 'Toggle IOC' }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('observables/obs-2', {
        json: { ioc: false, sighted: false },
      }),
    )

    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Mark sighted' }),
    )

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('observables/obs-2', {
        json: { ioc: false, sighted: true },
      }),
    )
  })
})

describe('case details tab', () => {
  test('keeps custom fields out of the details panel', () => {
    render(<CaseTabHarness tab="details" />)

    expect(screen.getByText('OAuth consent grant investigation.')).toBeDefined()
    expect(screen.queryByText('Affected users')).toBeNull()
    expect(screen.queryByText('BILL-2026-Q2')).toBeNull()
  })

  test('removes rich text side padding while the description is in read mode', () => {
    render(<CaseTabHarness tab="details" />)

    expect(screen.getByTestId('case-description-read-mode')).toBeDefined()
  })
})

describe('case custom fields tab', () => {
  test('renders case custom fields in their own tab panel', () => {
    render(<CaseTabHarness tab="custom-fields" />)

    expect(screen.getByText('Affected users')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('Business unit')).toBeDefined()
    expect(screen.getByText('Corporate IT')).toBeDefined()
    expect(screen.getByText('Campaign ID')).toBeDefined()
    expect(screen.getByText('BILL-2026-Q2')).toBeDefined()
  })

  test('renders custom fields as a case-style table with an add action', () => {
    render(<CaseTabHarness tab="custom-fields" />)

    expect(
      screen.getByRole('button', { name: /add custom field/i }),
    ).toBeDefined()
    expect(
      screen.getByRole('table', { name: /case custom fields/i }),
    ).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Field' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeDefined()
  })
})

describe('case tab panel headers', () => {
  test.each([
    ['custom-fields', 'Custom fields'],
    ['tasks', 'Tasks'],
    ['observables', 'Observables'],
    ['comments', 'Comments'],
    ['attachments', 'Attachments'],
    ['timeline', 'Timeline'],
    ['sharing', 'Sharing'],
  ] as const)('renders a %s panel header', (tab, label) => {
    render(<CaseTabHarness tab={tab} />)

    expect(screen.getByText(label, { exact: true })).toBeDefined()
  })
})

describe('case tasks tab', () => {
  test('renders tasks as a case-style table with an add action and no inline add form', () => {
    render(<CaseTabHarness tab="tasks" />)

    expect(screen.getByRole('button', { name: /^add task$/i })).toBeDefined()
    expect(screen.getByRole('table', { name: /case tasks/i })).toBeDefined()
    expect(
      screen.getByRole('columnheader', { name: 'Task name' }),
    ).toBeDefined()
    expect(screen.queryByRole('columnheader', { name: 'Task' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Due' })).toBeDefined()
    expect(screen.queryByPlaceholderText(/add a task/i)).toBeNull()
  })

  test('does not strike through completed task titles or render row checkboxes', () => {
    render(<CaseTabHarness tab="tasks" />)

    const taskTitle = screen.getByText(
      'Disable malicious app registration tenant-wide',
    )

    expect(taskTitle.closest('p')?.style.textDecoration).toBe('')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('replaces the task list with inline task details when a task row is clicked', async () => {
    render(<CaseTabHarness tab="tasks" />)

    fireEvent.click(
      screen.getByText('Disable malicious app registration tenant-wide'),
    )

    expect(
      screen.queryByRole('dialog', {
        name: /task detail/i,
      }),
    ).toBeNull()

    expect(
      screen.getByRole('button', {
        name: /back to tasks/i,
      }),
    ).toBeDefined()
    expect(screen.getByText('#1842 · task T-1842-4')).toBeDefined()
    expect(
      screen.getAllByDisplayValue(
        'Disable malicious app registration tenant-wide',
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /in progress/i })).toBeNull()
    expect(
      screen.getByRole<HTMLInputElement>('combobox', { name: 'Status' }).value,
    ).toBe('In progress')
    expect(screen.getByDisplayValue('Contain')).toBeDefined()
    expect(
      screen.getByText(/Block the app registration .* blocked apps policy/),
    ).toBeDefined()
    expect(
      screen.getByText(/App registration disabled in our tenant/),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /back to tasks/i }))

    expect(
      screen.queryByRole('button', {
        name: /back to tasks/i,
      }),
    ).toBeNull()
    expect(
      screen.getByText('Disable malicious app registration tenant-wide'),
    ).toBeDefined()
  })

  test('uses rich-text editing for task descriptions and work logs with attachment support', () => {
    const { container } = render(<CaseTabHarness tab="tasks" />)

    fireEvent.click(
      screen.getByText('Disable malicious app registration tenant-wide'),
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /edit description/i,
      }),
    )

    expect(
      screen.getByRole('button', { name: /save description/i }),
    ).toBeDefined()
    expect(
      container.querySelector('[contenteditable="true"].ProseMirror'),
    ).not.toBeNull()

    expect(
      screen.getByRole('button', {
        name: /edit work log from j\. tanaka at 12 june, 10:08 am/i,
      }),
    ).toBeDefined()
    expect(screen.getByText(/tenant-blocklist-approval\.pdf/)).toBeDefined()
    expect(screen.getByLabelText('Work log attachments')).toBeDefined()
    expect(screen.queryByText(/^Attach files$/)).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /attach files/i,
      }),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /save work log/i })).toBeDefined()
  })
})

describe('case task drawer regression', () => {
  test('does not open the old task detail drawer when a task row is clicked', async () => {
    render(<CaseTabHarness tab="tasks" />)

    fireEvent.click(
      screen.getByText('Disable malicious app registration tenant-wide'),
    )

    const drawer = screen.queryByRole('dialog', {
      name: /task detail/i,
    })

    expect(drawer).toBeNull()
  })
})

describe('case comments tab', () => {
  test('uses the rich text editor for adding comments', () => {
    const { container } = render(<CaseTabHarness tab="comments" />)

    expect(screen.queryByPlaceholderText(/add a comment/i)).toBeNull()
    expect(
      container.querySelector('[contenteditable="true"].ProseMirror'),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: /post comment/i })).toBeDefined()
  })

  test('uses a select control for comment sorting', () => {
    render(<CaseTabHarness tab="comments" />)

    const sortSelect = screen.getByRole('combobox', {
      name: /sort comments/i,
    })

    expect(sortSelect).toBeDefined()
    expect(screen.queryByRole('button', { name: /newest first/i })).toBeNull()
  })
})

describe('case timeline tab', () => {
  test('does not render the old case log input form', () => {
    render(<CaseTabHarness tab="timeline" />)

    expect(
      screen.queryByPlaceholderText(/add a note to the case log/i),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /^post$/i })).toBeNull()
  })
})

describe('case attachments tab', () => {
  test('renders attachments as a two-column table with upload action', () => {
    render(<CaseTabHarness tab="attachments" />)

    expect(screen.getByRole('button', { name: /upload file/i })).toBeDefined()
    expect(
      screen.getByRole('table', { name: /case attachments/i }),
    ).toBeDefined()
    const attachmentsTable = screen.getByRole('table', {
      name: /case attachments/i,
    })
    const headers = within(attachmentsTable).getAllByRole('columnheader')
    expect(headers).toHaveLength(2)
    expect(headers[0]?.textContent).toBe('File')
    // Actions column is icon-only with a blank header, like the cases list.
    expect(headers[1]?.textContent).toBe('')
    expect(screen.queryByRole('columnheader', { name: /size/i })).toBeNull()
    expect(screen.getByText('tenant-blocklist-approval.pdf')).toBeDefined()
  })
})
