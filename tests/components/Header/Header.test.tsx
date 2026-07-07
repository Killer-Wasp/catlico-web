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
  api: { get: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

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
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({
      id: 'u1',
      email: 'j.tanaka@origin.example',
      is_active: true,
      is_superadmin: false,
      created_at: '2026-01-01T00:00:00Z',
      last_login_at: null,
    }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
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
})

describe('Header account menu', () => {
  test('shows the current user, and logs out clearing the session', async () => {
    localStorage.setItem('catlico.accessToken', 'a')
    localStorage.setItem('catlico.refreshToken', 'r')
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

    expect(localStorage.getItem('catlico.accessToken')).toBeNull()
    expect(localStorage.getItem('catlico.refreshToken')).toBeNull()
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
    vi.mocked(api.get).mockReturnValue({
      json: async () => ({
        id: 'u1',
        email: 'j.tanaka@origin.example',
        is_active: true,
        is_superadmin: true,
        created_at: '2026-01-01T00:00:00Z',
        last_login_at: null,
      }),
    } satisfies JsonResponse as ReturnType<typeof api.get>)

    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(await screen.findByText('Organisations')).toBeDefined()
  })
})
