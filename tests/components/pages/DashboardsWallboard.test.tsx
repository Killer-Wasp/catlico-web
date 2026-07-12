import { MantineProvider } from '@mantine/core'
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
import { api } from '#/lib/api/client'
import { DashboardsPage } from '#/components/pages/DashboardsPage'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useBlocker: () => ({ status: 'idle' }) }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    if (url.startsWith('dashboards')) {
      return { json: async () => [] } satisfies JsonResponse as ReturnType<
        typeof api.get
      >
    }
    // Overview metrics aren't needed for the toolbar; fail fast so the body
    // shows its error state while the toolbar (and Fullscreen button) render.
    return {
      json: async (): Promise<unknown> => {
        throw new Error('no metrics in this test')
      },
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
})

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <DashboardsPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

afterEach(cleanup)

describe('DashboardsPage wallboard mode', () => {
  test('toggles fullscreen wallboard on and off', async () => {
    const { container } = render(<Harness />)

    const enter = await screen.findByRole('button', {
      name: /fullscreen wallboard/i,
    })
    // Not in wallboard yet: no page element carries the wallboard marker.
    expect(container.querySelector('[data-wallboard="true"]')).toBeNull()

    fireEvent.click(enter)

    await waitFor(() =>
      expect(
        container.querySelector('[data-wallboard="true"]'),
      ).not.toBeNull(),
    )
    const exit = screen.getByRole('button', { name: /exit fullscreen/i })
    fireEvent.click(exit)

    await waitFor(() =>
      expect(container.querySelector('[data-wallboard="true"]')).toBeNull(),
    )
  })
})
