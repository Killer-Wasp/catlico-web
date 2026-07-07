// @vitest-environment jsdom
import { FunctionsPage } from '#/components/pages/FunctionsPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Harness({ initialNew = false }: { initialNew?: boolean } = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <FunctionsPage initialNew={initialNew} />
      </MantineProvider>
    </QueryClientProvider>
  )
}

type JsonResponse = { json: () => Promise<unknown> }

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.delete).mockReset()
  queryClient.clear()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items: [], total: 0, skip: 0, limit: 100 }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
})

afterEach(cleanup)

describe('FunctionsPage', () => {
  test('renders the functions page heading and empty state', async () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Functions' })).toBeDefined()
    expect(
      screen.getByText(
        'automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile',
      ),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: '+ New function' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'All functions' })).toBeDefined()
    expect(await screen.findByText('No functions yet. Create one to get started.')).toBeDefined()
  })

  test('opens new function editor when + New function is clicked', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '+ New function' }))

    expect(screen.getByRole('heading', { name: 'New function' })).toBeDefined()
    expect(screen.getByText('create an automation')).toBeDefined()
  })

  test('can open directly in new function editor mode', () => {
    render(<Harness initialNew />)

    expect(screen.getByRole('heading', { name: 'New function' })).toBeDefined()
    expect(screen.getByText('create an automation')).toBeDefined()
  })

  test('returns to list from editor via back button', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '+ New function' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Functions' })).toBeDefined()
  })
})
