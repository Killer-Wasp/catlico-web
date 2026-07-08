// @vitest-environment jsdom
import { TasksPage } from '#/components/pages/TasksPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as TanStackReactRouter from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

const navigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const taskDto = {
  id: 4,
  public_id: 'T-1842-4',
  case_id: 1842,
  organisation_id: 'org-a',
  title: 'Revoke refresh tokens',
  group: 'Contain',
  description: 'OAuth consent grant',
  status: 'Waiting',
  assignee_id: null,
  order: 0,
  flagged: false,
  start_date: null,
  due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  end_date: null,
  created_at: '2026-06-21T01:00:00Z',
  updated_at: null,
  case_title: 'OAuth consent grant',
  case_severity: 3,
  assignee_email: null,
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <TasksPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  navigate.mockReset()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items: [taskDto], total: 1, skip: 0, limit: 200 }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({ ...taskDto, status: 'InProgress' }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
})

afterEach(cleanup)

describe('TasksPage', () => {
  test('renders the backend task queue with search, sort and row actions', async () => {
    render(<Harness />)

    expect(await screen.findByText('Revoke refresh tokens')).toBeDefined()
    expect(screen.getByText('in a day')).toBeDefined()
    expect(screen.getByPlaceholderText(/Filter tasks/i)).toBeDefined()
    // Server-side now: the list is fetched with a paginated searchParams window.
    const listCall = vi
      .mocked(api.get)
      .mock.calls.find((c) => c[0] === 'task-queue')
    expect(listCall).toBeDefined()
    const sp = (listCall![1] as { searchParams: URLSearchParams }).searchParams
    expect(sp.get('limit')).toBe('10')
    expect(sp.get('skip')).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: /task actions/i }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Advance status' }),
    )

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        'cases/1842/tasks/4',
        { json: { status: 'InProgress' } },
      ),
    )
  })

  test('shows a backend error instead of falling back to fixture tasks', async () => {
    vi.mocked(api.get).mockReturnValue({
      json: async (): Promise<unknown> => {
        throw new Error('backend unavailable')
      },
    } satisfies JsonResponse as ReturnType<typeof api.get>)

    render(<Harness />)

    expect(
      await screen.findByText('Couldn’t load tasks from the backend.'),
    ).toBeDefined()
    expect(
      screen.queryByText('Pull EDR timeline for initial access'),
    ).toBeNull()
  })
})
