/**
 * PluginConfigDrawer component tests.
 * @vitest-environment jsdom
 */
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
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PluginConfigDrawer } from '#/components/pages/plugins/PluginConfigDrawer'
import type { Plugin, PluginConfigParam, ParamConfigStatus } from '#/components/Plugins/plugins.types'
import { api } from '#/lib/api/client'

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

vi.mock('ky', () => ({
  isHTTPError: (e: unknown) =>
    (e as Record<string, unknown>)?.__isHTTPError === true,
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function testPlugin(overrides?: Partial<Plugin>): Plugin {
  const params: PluginConfigParam[] = overrides?.configParams ?? [
    { name: 'api_key', type: 'secret', required: true, description: 'API key' },
    { name: 'host', type: 'string', required: true, description: 'Server host' },
    { name: 'max_retries', type: 'integer', required: false, defaultValue: 3 },
  ]

  return {
    id: 'test-plugin',
    displayName: 'Test Plugin',
    description: 'A test plugin for unit tests',
    manifest: { version: '1.0.0', configuration: params },
    available: true,
    runnerId: 'runner-1',
    runnerIds: ['runner-1'],
    enabled: true,
    autoRunEnabled: false,
    autoApplyActions: [],
    configParams: params,
    configComplete: true,
    ...overrides,
  }
}

function renderDrawer(plugin: Plugin, configStatus?: Record<string, ParamConfigStatus>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const onClose = vi.fn()

  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <PluginConfigDrawer
          plugin={plugin}
          configStatus={configStatus}
          onClose={onClose}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )

  return { onClose, queryClient }
}

function makeHTTPError(status: number, body: unknown): Error & { __isHTTPError: boolean; response: { status: number; json: () => Promise<unknown> } } {
  return Object.assign(new Error(`HTTP ${status}`), {
    __isHTTPError: true,
    response: { status, json: async () => body },
  })
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false, media: '',
      onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class { observe() {} unobserve() {} disconnect() {} },
  })
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { writable: true, value: () => {} })
})

beforeEach(() => {
  vi.mocked(api.put).mockReset()
  vi.mocked(api.post).mockReset()
})

afterEach(cleanup)

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PluginConfigDrawer', () => {
  test('renders drawer with plugin name and description', () => {
    renderDrawer(testPlugin())
    expect(screen.getByText('Test Plugin')).toBeInTheDocument()
    expect(screen.getByText('A test plugin for unit tests')).toBeInTheDocument()
  })

  test('shows enabled and available badges', () => {
    renderDrawer(testPlugin())
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  test('shows incomplete config badge when required params are missing', () => {
    const cs: Record<string, ParamConfigStatus> = {
      api_key: { status: 'missing', source: 'org' },
      host: { status: 'configured', source: 'org' },
    }
    renderDrawer(testPlugin(), cs)
    expect(screen.getByText('Incomplete config')).toBeInTheDocument()
  })

  test('shows config complete badge when all required are configured', () => {
    const cs: Record<string, ParamConfigStatus> = {
      api_key: { status: 'configured', source: 'org', secret_configured: true },
      host: { status: 'configured', source: 'org' },
    }
    renderDrawer(testPlugin(), cs)
    expect(screen.getByText('Config complete')).toBeInTheDocument()
  })

  test('shows "no configuration needed" for plugins without params', () => {
    renderDrawer(testPlugin({ configParams: [] }))
    expect(screen.getByText('This plugin does not require configuration.')).toBeInTheDocument()
  })

  test('renders all config param field labels', () => {
    renderDrawer(testPlugin())
    expect(screen.getByText('api_key')).toBeInTheDocument()
    expect(screen.getByText('host')).toBeInTheDocument()
    expect(screen.getByText('max_retries')).toBeInTheDocument()
  })

  // ── Secret fields ─────────────────────────────────────────────────────────

  test('secret field with stored secret shows "Stored" badge', () => {
    const cs: Record<string, ParamConfigStatus> = {
      api_key: { status: 'configured', source: 'org', secret_configured: true },
    }
    renderDrawer(
      testPlugin({ configParams: [{ name: 'api_key', type: 'secret', required: true }] }),
      cs,
    )
    expect(screen.getByText('Stored')).toBeInTheDocument()
  })

  test('secret field with stored secret shows "Clear" action', () => {
    const cs: Record<string, ParamConfigStatus> = {
      api_key: { status: 'configured', source: 'org', secret_configured: true },
    }
    renderDrawer(
      testPlugin({ configParams: [{ name: 'api_key', type: 'secret', required: true }] }),
      cs,
    )
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  test('secret field without stored secret hides "Stored" badge', () => {
    renderDrawer(
      testPlugin({ configParams: [{ name: 'api_key', type: 'secret', required: true }] }),
    )
    expect(screen.queryByText('Stored')).not.toBeInTheDocument()
  })

  // ── Environment-locked fields ─────────────────────────────────────────────

  test('env-locked field is read-only with initial value', () => {
    renderDrawer(
      testPlugin({
        configParams: [{ name: 'region', source: 'environment', defaultValue: 'us-east-1' }],
      }),
    )
    expect(screen.getByDisplayValue('us-east-1')).toBeInTheDocument()
  })

  // ── Save flow ─────────────────────────────────────────────────────────────

  test('pristine form shows "No changes to save" on Save click', async () => {
    renderDrawer(testPlugin())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.getByText('No changes to save')).toBeInTheDocument()
    })
  })

  test('Save sends only dirty keys to the API', async () => {
    const plugin = testPlugin({
      configParams: [
        { name: 'host', type: 'string', required: true },
        { name: 'port', type: 'integer', required: false },
      ],
    })
    renderDrawer(plugin)

    const hostInput = screen.getByRole('textbox', { name: /host/i })
    fireEvent.change(hostInput, { target: { value: 'api.example.com' } })

    vi.mocked(api.put).mockReturnValue({
      json: async () => ({ settings: {}, has_secrets: false }),
    } as any)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalled()
    })
    const call = vi.mocked(api.put).mock.calls[0]
    expect(call[0]).toBe('plugins/test-plugin/config')
    const body = (call[1] as { json: Record<string, unknown> }).json
    expect(body).toHaveProperty('settings.host', 'api.example.com')
    expect(body).not.toHaveProperty('settings.port')
  })

  // ── 422 error mapping ────────────────────────────────────────────────────

  test('422 maps field errors to form fields', async () => {
    const plugin = testPlugin({
      configParams: [{ name: 'host', type: 'string', required: true }],
    })
    renderDrawer(plugin)

    const hostInput = screen.getByRole('textbox', { name: /host/i })
    fireEvent.change(hostInput, { target: { value: 'bad' } })

    vi.mocked(api.put).mockReturnValue({
      json: () => {
        throw makeHTTPError(422, {
          detail: [{ loc: ['body', 'settings', 'host'], msg: 'Invalid hostname' }],
        })
      },
    } as any)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid hostname')).toBeInTheDocument()
    })
  })

  // ── Save & Test ──────────────────────────────────────────────────────────

  test('Save & Test shows inline verdict on success', async () => {
    const plugin = testPlugin({
      configParams: [{ name: 'host', type: 'string', required: true }],
    })
    renderDrawer(plugin)

    fireEvent.change(screen.getByRole('textbox', { name: /host/i }), {
      target: { value: 'example.com' },
    })

    vi.mocked(api.put).mockReturnValue({
      json: async () => ({ settings: {}, has_secrets: false }),
    } as any)

    vi.mocked(api.post).mockImplementation((input) => {
      if (String(input).includes('config/test')) {
        return { json: async () => ({ ok: true, message: 'All checks passed' }) } as ReturnType<typeof api.post>
      }
      return { json: async () => ({}) } as ReturnType<typeof api.post>
    })

    fireEvent.click(screen.getByRole('button', { name: /Save & Test/ }))

    await waitFor(() => {
      expect(screen.getByText('Test passed')).toBeInTheDocument()
    })
  })

  test('Save & Test shows failure verdict on test error', async () => {
    const plugin = testPlugin({
      configParams: [{ name: 'host', type: 'string', required: true }],
    })
    renderDrawer(plugin)

    fireEvent.change(screen.getByRole('textbox', { name: /host/i }), {
      target: { value: 'example.com' },
    })

    vi.mocked(api.put).mockReturnValue({
      json: async () => ({ settings: {}, has_secrets: false }),
    } as any)

    vi.mocked(api.post).mockImplementation((input) => {
      if (String(input).includes('config/test')) {
        throw new Error('Connection refused')
      }
      return { json: async () => ({}) } as ReturnType<typeof api.post>
    })

    fireEvent.click(screen.getByRole('button', { name: /Save & Test/ }))

    await waitFor(() => {
      expect(screen.getByText('Test failed')).toBeInTheDocument()
    })
  })

  // ── Secret clear → null ──────────────────────────────────────────────────

  test('clearing a stored secret sends null to delete it', async () => {
    const cs: Record<string, ParamConfigStatus> = {
      api_key: { status: 'configured', source: 'org', secret_configured: true },
    }
    renderDrawer(
      testPlugin({ configParams: [{ name: 'api_key', type: 'secret', required: true }] }),
      cs,
    )

    fireEvent.click(screen.getByText('Clear'))

    vi.mocked(api.put).mockReturnValue({
      json: async () => ({ settings: {}, has_secrets: false }),
    } as any)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        'plugins/test-plugin/config',
        expect.objectContaining({
          json: { secrets: { api_key: null } },
        }),
      )
    })
  })
})
