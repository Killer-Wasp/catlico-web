// @vitest-environment jsdom
import { getCaseDetail } from '#/components/Cases/caseDetails'
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

function CaseTabHarness({
  tab,
}: {
  tab: 'comments' | 'observables' | 'tasks'
}) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <CaseTabPanel
          tab={tab}
          caseDetail={getCaseDetail('1842')}
          caseId="1842"
        />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => enrichmentOverview,
  } satisfies JsonResponse as ReturnType<typeof api.get>)
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
})

afterEach(cleanup)

describe('case observables tab', () => {
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
})

describe('case tasks tab', () => {
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
      (screen.getByRole('combobox', { name: 'Status' }) as HTMLInputElement)
        .value,
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
})
