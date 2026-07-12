// @vitest-environment jsdom
import { Header } from '#/components/Header/Header'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
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
    post: vi.fn(() => Promise.resolve()),
    patch: vi.fn(() => Promise.resolve()),
  },
}))

type JsonResponse = { json: () => Promise<unknown> }

const emptyFeed = { items: [], total: 0, skip: 0, limit: 50 }

const currentUser = {
  id: 'u1',
  email: 'j.tanaka@origin.example',
  is_active: true,
  is_superadmin: false,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
}

// The Header fetches BOTH the current user and the notification feed on mount;
// branch the shared api.get mock by URL so each gets the right shape.
function mockGet(payloads: { user?: unknown; feed?: unknown }) {
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    const body = url.startsWith('notifications')
      ? (payloads.feed ?? emptyFeed)
      : (payloads.user ?? currentUser)
    return { json: async () => body } satisfies JsonResponse as ReturnType<
      typeof api.get
    >
  })
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
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockClear()
  mockGet({})
})

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Header />
      </MantineProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)

describe('Header notifications', () => {
  test('shows an empty notification popover when there are none', async () => {
    render(<Harness />)

    // No unread notifications ⇒ no count badge.
    expect(screen.queryByText('3')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    const panel = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(within(panel).getByText('Notifications')).toBeDefined()
    expect(within(panel).getByText('No notifications')).toBeDefined()
    expect(within(panel).getByText(/Settings → Notifications/)).toBeDefined()
  })

  test('renders the unread feed and marks an item read on click', async () => {
    mockGet({
      feed: {
        items: [
          {
            id: 'n1',
            event_type: 'case.created',
            title: 'New case assigned',
            body: 'CASE-42',
            payload: {},
            read_at: null,
            created_at: '2026-06-12T09:12:00Z',
          },
        ],
        total: 1,
        skip: 0,
        limit: 50,
      },
    })

    render(<Harness />)

    // Unread count badge (1) shows on the bell.
    expect(await screen.findByText('1')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    const panel = await screen.findByRole('dialog', { name: 'Notifications' })
    fireEvent.click(within(panel).getByText('New case assigned'))

    // Clicking an unread item PATCHes it read.
    await waitFor(() =>
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        'notifications/n1',
        expect.objectContaining({
          json: expect.objectContaining({ read_at: expect.any(String) }),
        }),
      ),
    )
  })
})

describe('Header account menu', () => {
  test('shows the current user, and logs out clearing the session', async () => {
    // Only the active org lives in localStorage now — the access token is held
    // in JS memory and the refresh token is an httpOnly cookie (invisible here).
    localStorage.setItem('catlico.orgId', 'o')
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign },
    })

    render(<Harness />)

    // Avatar initials derive from the current user's email.
    expect(await screen.findByText('JT')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(await screen.findByText('j.tanaka@origin.example')).toBeDefined()
    fireEvent.click(await screen.findByText('Log out'))

    // Server-side revocation is fired at the cookie-authed logout endpoint...
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(
      'auth/logout',
      expect.objectContaining({
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    // ...and the local session (active org) is cleared.
    expect(localStorage.getItem('catlico.orgId')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  test('hides the Organisations link for a non-superadmin', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(await screen.findByText('Account settings')).toBeDefined()
    expect(screen.queryByText('Organisations')).toBeNull()
  })

  test('shows the Organisations link for a superadmin', async () => {
    mockGet({ user: { ...currentUser, is_superadmin: true } })

    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(await screen.findByText('Organisations')).toBeDefined()
  })
})
