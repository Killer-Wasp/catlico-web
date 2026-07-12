import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
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
import { SlaPanel } from '#/components/pages/settings/panels/SlaPanel'

type JsonResponse = { json: () => Promise<unknown> }

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
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
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

const policy = {
  id: 3,
  severity: 2,
  ack_seconds: 900,
  resolve_seconds: 14400,
  escalation_target: 'Queue',
  enabled: true,
  organisation_id: 'origin-soc',
  created_at: '2026-07-12T00:00:00Z',
  updated_at: null,
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items: [policy], total: 1, skip: 0, limit: 100 }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
})

afterEach(cleanup)

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('SlaPanel delete', () => {
  test('deleting a saved policy confirms then DELETEs by id', async () => {
    render(
      <Harness>
        <SlaPanel />
      </Harness>,
    )
    await screen.findByText('MEDIUM')

    fireEvent.click(
      screen.getByRole('button', { name: /Delete MEDIUM SLA policy/i }),
    )

    const dialog = await screen.findByRole('dialog')
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )
    expect(confirm).toBeDefined()
    fireEvent.click(confirm as HTMLButtonElement)

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('sla-policies/3'),
    )
  })

  test('an unsaved (newly added) policy row is removed locally without an API call', async () => {
    // Start with no server policies so "Add" creates a purely local row.
    vi.mocked(api.get).mockReturnValue({
      json: async () => ({ items: [], total: 0, skip: 0, limit: 100 }),
    } satisfies JsonResponse as ReturnType<typeof api.get>)

    render(
      <Harness>
        <SlaPanel />
      </Harness>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /add sla policy/i }))

    // A LOW row (severity 1) is added locally; remove it.
    const removeButton = await screen.findByRole('button', {
      name: /Delete LOW SLA policy/i,
    })
    expect(removeButton.textContent).toBe('Remove')
    fireEvent.click(removeButton)

    await waitFor(() =>
      expect(screen.queryByText('LOW')).toBeNull(),
    )
    expect(api.delete).not.toHaveBeenCalled()
  })
})
