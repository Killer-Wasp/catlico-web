// @vitest-environment jsdom
//
// The notifier destination URL is a WRITE-ONLY secret: the create form sends it
// as `secrets.url` (never as the plaintext `target`), a webhook signing secret
// rides along as `secrets.signing_secret`, and the edit/rotate flow reveals a
// fresh URL input (the URL is never returned, so it is never prefilled). List
// rows and the delete-confirm render the server-derived `target` LABEL, never a
// URL. A 422 from the server surfaces as a friendly inline field error.
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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const SLACK_URL = 'https://hooks.slack.example/services/T/B/abc'

// `target` is the server-derived DISPLAY LABEL — never the destination URL.
const notifierDto = {
  id: 'notif-1',
  type: 'webhook' as const,
  target: 'hooks.slack.example/services/T/B/…',
  config: {},
  enabled: true,
  has_secrets: true,
  organisation_id: 'origin-soc',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: null,
}

const notifierDto2 = {
  id: 'notif-2',
  type: 'email' as const,
  target: 'analyst@example.test',
  config: {},
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

/** A ky-style HTTPError: `isHTTPError` keys off `name === 'HTTPError'`. */
function httpError(status: number, body: unknown): Error {
  const err = new Error(`HTTP ${status}`)
  Object.assign(err, {
    name: 'HTTPError',
    response: { status, json: () => Promise.resolve(body) },
    data: body,
  })
  return err
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
        json: async () => ({
          items: [notifierDto, notifierDto2],
          total: 2,
          skip: 0,
          limit: 100,
        }),
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
    json: async () => ({ ...notifierDto, id: 'notif-3' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)

  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
})

afterEach(cleanup)

async function openCreateModal() {
  fireEvent.click(screen.getByText('+ Add notifier'))
  return screen.findByRole('dialog')
}

describe('NotificationsPanel', () => {
  test('warns when a rule is enabled but wired to no notifiers', async () => {
    render(<Harness />)
    await screen.findByText('Critical alerts')
    expect(screen.getByText(/wired to no notifiers/i)).toBeDefined()
  })

  test('selecting a notifier for a rule PATCHes its notifier_ids', async () => {
    render(<Harness />)
    await screen.findByText('Critical alerts')

    fireEvent.click(screen.getByPlaceholderText('Select notifiers'))
    const option = await screen.findByRole('option', {
      name: /webhook — hooks\.slack\.example/i,
    })
    fireEvent.click(option)

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        'notifications/notification-rules/rule-1',
        { json: { notifier_ids: ['notif-1'] } },
      ),
    )
  })

  test('renders notifiers, rules, and message template from the backend', async () => {
    render(<Harness />)

    expect(await screen.findByText('webhook')).toBeDefined()
    expect(screen.getByText('email')).toBeDefined()
    expect(screen.getByText('Critical alerts')).toBeDefined()
    expect(screen.getAllByText(/Message template/).length).toBeGreaterThan(0)
  })

  test('list rows show the target label, never the destination URL', async () => {
    render(<Harness />)
    await screen.findByText('hooks.slack.example/services/T/B/…')
    expect(screen.queryByText(SLACK_URL)).toBeNull()
  })

  test('shows a per-notifier secrets indicator', async () => {
    render(<Harness />)
    await screen.findByText('webhook')
    // notif-1 has_secrets=true, notif-2 has_secrets=false.
    expect(screen.getByText('Secrets configured')).toBeDefined()
    expect(screen.getByText('No secrets')).toBeDefined()
  })

  test('+ Add notifier opens the create modal', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    await openCreateModal()
    expect(screen.getByText('Add notifier')).toBeDefined()
  })

  test('create posts the URL inside secrets, not as the plaintext target', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    const dialog = await openCreateModal()
    fireEvent.change(within(dialog).getByLabelText(/destination url/i), {
      target: { value: SLACK_URL },
    })
    fireEvent.click(within(dialog).getByText('Create notifier'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('notifications/notifiers/', {
        json: expect.objectContaining({
          type: 'slack',
          secrets: { url: SLACK_URL },
        }),
      }),
    )
    const body = vi.mocked(api.post).mock.calls[0][1] as {
      json: { target?: string }
    }
    expect(body.json.target).not.toBe(SLACK_URL)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(screen.getByText('Notifier created')).toBeDefined())
  })

  test('a webhook create posts secrets.signing_secret', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    const dialog = await openCreateModal()
    // Switch the type to Webhook via the Mantine Select.
    fireEvent.click(within(dialog).getByLabelText(/type/i))
    fireEvent.click(await screen.findByRole('option', { name: /webhook/i }))

    fireEvent.change(within(dialog).getByLabelText(/destination url/i), {
      target: { value: 'https://example.com/hook' },
    })
    fireEvent.change(within(dialog).getByLabelText(/signing secret/i), {
      target: { value: 's3cr3t' },
    })
    fireEvent.click(within(dialog).getByText('Create notifier'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('notifications/notifiers/', {
        json: expect.objectContaining({
          type: 'webhook',
          secrets: { url: 'https://example.com/hook', signing_secret: 's3cr3t' },
        }),
      }),
    )
  })

  test('an empty URL blocks the create POST with a field error', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    const dialog = await openCreateModal()
    fireEvent.click(within(dialog).getByText('Create notifier'))

    await waitFor(() =>
      expect(screen.getByText(/destination url is required/i)).toBeDefined(),
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  test('surfaces a 422 (bad scheme / private IP) as an inline field error', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => {
        throw httpError(422, {
          detail: [
            {
              loc: ['body', 'secrets', 'url'],
              msg: 'URL must use the http or https scheme',
            },
          ],
        })
      },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.post>)

    render(<Harness />)
    await screen.findByText('webhook')

    const dialog = await openCreateModal()
    fireEvent.change(within(dialog).getByLabelText(/destination url/i), {
      target: { value: 'ftp://nope' },
    })
    fireEvent.click(within(dialog).getByText('Create notifier'))

    expect(
      await screen.findByText('URL must use the http or https scheme'),
    ).toBeDefined()
  })

  test('shows error notification when create fails', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => {
        throw new Error('Backend unavailable')
      },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.post>)

    render(<Harness />)
    await screen.findByText('webhook')

    const dialog = await openCreateModal()
    fireEvent.change(within(dialog).getByLabelText(/destination url/i), {
      target: { value: SLACK_URL },
    })
    fireEvent.click(within(dialog).getByText('Create notifier'))

    await waitFor(() =>
      expect(screen.getByText('Backend unavailable')).toBeDefined(),
    )
  })

  test('edit shows the label + secrets indicator and does NOT prefill a URL', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText(/hooks\.slack\.example/)).toBeDefined()
    expect(within(dialog).getByText(/secrets configured/i)).toBeDefined()

    // The URL input is revealed on demand and starts empty (nothing to prefill).
    fireEvent.click(within(dialog).getByRole('button', { name: /change url/i }))
    expect(within(dialog).getByLabelText(/destination url/i)).toHaveValue('')
  })

  test('the change-URL flow PATCHes a fresh secrets.url', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: /change url/i }))
    fireEvent.change(within(dialog).getByLabelText(/destination url/i), {
      target: { value: 'https://hooks.slack.example/services/NEW/HOOK/z' },
    })
    fireEvent.click(within(dialog).getByText('Save changes'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('notifications/notifiers/notif-1', {
        json: {
          secrets: { url: 'https://hooks.slack.example/services/NEW/HOOK/z' },
        },
      }),
    )
  })

  test('removing a webhook signing secret PATCHes signing_secret: null', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    // notif-1 is the webhook fixture; open its editor.
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByLabelText('Remove stored signing secret'))
    fireEvent.click(within(dialog).getByText('Save changes'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('notifications/notifiers/notif-1', {
        json: { secrets: { signing_secret: null } },
      }),
    )
  })

  test('typing a signing secret then checking remove still sends null (removal wins)', async () => {
    render(<Harness />)
    await screen.findByText('webhook')

    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Signing secret'), {
      target: { value: 'typed-value' },
    })
    fireEvent.click(within(dialog).getByLabelText('Remove stored signing secret'))
    fireEvent.click(within(dialog).getByText('Save changes'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('notifications/notifiers/notif-1', {
        json: { secrets: { signing_secret: null } },
      }),
    )
  })

  test('deleting a notifier confirms with the label then calls DELETE', async () => {
    render(<Harness />)
    await screen.findByText('webhook')
    const getCount = vi.mocked(api.get).mock.calls.length

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    // Confirmation modal from confirmDelete; its copy names the label, not a URL.
    const confirmButton = await screen.findByRole('button', {
      name: 'Delete notifier',
    })
    const confirmDialog = confirmButton.closest('[role="dialog"]') as HTMLElement
    expect(
      within(confirmDialog).getByText(/hooks\.slack\.example/),
    ).toBeDefined()
    expect(within(confirmDialog).queryByText(SLACK_URL)).toBeNull()

    fireEvent.click(confirmButton)

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

    await openCreateModal()
    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.post).not.toHaveBeenCalled()
  })
})
