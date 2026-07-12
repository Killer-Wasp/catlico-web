// @vitest-environment jsdom
import { NotificationsPanel } from '#/components/pages/settings/panels/NotificationsPanel'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const notifierDto = {
  id: 'notif-1',
  type: 'webhook' as const,
  target: 'https://hooks.slack.example/abc',
  config: { channel: '#alerts' },
  enabled: true,
  has_secrets: false,
  organisation_id: 'origin-soc',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: null,
}

const notifierDto2 = {
  id: 'notif-2',
  type: 'email' as const,
  target: 'analyst@example.test',
  config: { template: 'default' },
  enabled: false,
  has_secrets: false,
  organisation_id: 'origin-soc',
  created_at: '2026-06-19T00:00:00Z',
  updated_at: null,
}

const ruleDto = {
  id: 'rule-1',
  name: 'Critical alerts',
  description: 'Notify on critical alerts',
  event: null,
  enabled: true,
  notifier_ids: [],
  organisation_id: 'origin-soc',
  created_at: '2026-06-20T00:00:00Z',
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ModalsProvider>
          <Notifications />
          <NotificationsPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()

  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    if (url.includes('notifiers')) {
      return {
        json: async () => ({ items: [notifierDto, notifierDto2], total: 2, skip: 0, limit: 100 }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    return {
      json: async () => ({ items: [ruleDto], total: 1, skip: 0, limit: 100 }),
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })

  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({ ...notifierDto, enabled: false }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)

  vi.mocked(api.post).mockReturnValue({
    json: async () => ({
      id: 'notif-3',
      type: 'slack',
      target: 'https://hooks.slack.example/xyz',
      config: { channel: '#incidents' },
      enabled: true,
      has_secrets: false,
      organisation_id: 'origin-soc',
      created_at: '2026-06-24T00:00:00Z',
      updated_at: null,
    }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)

  vi.mocked(api.delete).mockReturnValue(
    {} as ReturnType<typeof api.delete>,
  )
})

afterEach(cleanup)

describe('NotificationsPanel', () => {
  test('warns when a rule is enabled but wired to no notifiers', async () => {
    render(<Harness />)
    await screen.findByText('Critical alerts')
    expect(
      screen.getByText(/wired to no notifiers/i),
    ).toBeDefined()
  })

  test('selecting a notifier for a rule PATCHes its notifier_ids', async () => {
    render(<Harness />)
    await screen.findByText('Critical alerts')

    // Open the rule's notifier picker and choose the first notifier option.
    fireEvent.click(screen.getByPlaceholderText('Select notifiers'))
    const option = await screen.findByRole('option', {
      name: /webhook — https:\/\/hooks\.slack\.example\/abc/i,
    })
    fireEvent.click(option)

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        'notifications/notification-rules/rule-1',
        { json: { notifier_ids: ['notif-1'] } },
      ),
    )
  })

  test('shows a per-notifier secrets indicator', async () => {
    render(<Harness />)
    await screen.findByText('webhook')
    // Both fixtures have has_secrets=false → "no secret" badge + "Set secrets" cta.
    expect(screen.getAllByText('no secret').length).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /set secrets/i }).length,
    ).toBeGreaterThan(0)
  })

  test('rotating secrets PATCHes the notifier with the new JSON', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(
      screen.getAllByRole('button', { name: /set secrets/i })[0],
    )
    await screen.findByRole('dialog')

    fireEvent.change(screen.getByRole('textbox', { name: /secrets/i }), {
      target: { value: '{"token":"abc"}' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save secrets/i }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('notifications/notifiers/notif-1', {
        json: { secrets: { token: 'abc' } },
      }),
    )
  })

  test('invalid secrets JSON blocks the rotation PATCH', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(
      screen.getAllByRole('button', { name: /set secrets/i })[0],
    )
    await screen.findByRole('dialog')

    fireEvent.change(screen.getByRole('textbox', { name: /secrets/i }), {
      target: { value: '{bad' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save secrets/i }))

    await waitFor(() => expect(screen.getByText('Invalid JSON')).toBeDefined())
    expect(api.patch).not.toHaveBeenCalledWith(
      'notifications/notifiers/notif-1',
      expect.objectContaining({ json: expect.anything() }),
    )
  })

  test('renders notifiers, rules, and message template from the backend', async () => {
    render(<Harness />)

    expect(await screen.findByText('webhook')).toBeDefined()
    expect(screen.getByText('email')).toBeDefined()
    expect(screen.getByText('Critical alerts')).toBeDefined()
    const messageElements = screen.getAllByText(/Message template/)
    expect(messageElements.length).toBeGreaterThan(0)
  })

  test('clicking + Add notifier opens the create modal', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getByText('+ Add notifier'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeDefined()
    expect(screen.getByText('Add notifier')).toBeDefined()
  })

  test('invalid JSON in config or secrets blocks submission and shows validation errors', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getByText('+ Add notifier'))
    await screen.findByRole('dialog')

    const configTextarea = screen.getByRole('textbox', { name: /config/i })
    fireEvent.change(configTextarea, { target: { value: '{bad json' } })

    fireEvent.click(screen.getByText('Create notifier'))

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON')).toBeDefined()
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  test('valid form submission calls POST and invalidates settings on success', async () => {
    render(<Harness />)
    await screen.findByText('webhook')
    const getCount = vi.mocked(api.get).mock.calls.length

    fireEvent.click(screen.getByText('+ Add notifier'))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByText('Create notifier'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('notifications/notifiers/', {
        json: {
          type: 'webhook',
          target: undefined,
          enabled: true,
          config: {},
          secrets: {},
        },
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    await waitFor(() => {
      expect(screen.getByText('Notifier created')).toBeDefined()
    })

    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(getCount),
    )
  })

  test('shows error notification when create fails', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => { throw new Error('Backend unavailable') },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.post>)

    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getByText('+ Add notifier'))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByText('Create notifier'))

    await waitFor(() => {
      expect(screen.getByText('Backend unavailable')).toBeDefined()
    })
  })

  test('deleting a notifier confirms then calls DELETE and invalidates settings', async () => {
    render(<Harness />)
    await screen.findByText('webhook')
    const getCount = vi.mocked(api.get).mock.calls.length

    // Each notifier row has its own Delete button; act on the first.
    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    // Confirmation modal from confirmDelete; confirm to proceed.
    const confirmModal = await screen.findByRole('dialog')
    const confirmButton = Array.from(
      confirmModal.querySelectorAll('button'),
    ).find((b) => b.textContent === 'Delete')
    expect(confirmButton).toBeDefined()
    fireEvent.click(confirmButton as HTMLButtonElement)

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('notifications/notifiers/notif-1'),
    )
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(getCount),
    )
  })

  test('cancel button closes the modal without calling the API', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getByText('+ Add notifier'))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    expect(api.post).not.toHaveBeenCalled()
  })
})
