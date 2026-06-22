// @vitest-environment jsdom
import { ConnectorsPage } from '#/components/pages/ConnectorsPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
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
    post: vi.fn(),
    put: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const connectorDto = {
  name: 'abuseipdb',
  display_name: 'AbuseIPDB',
  connector_type: 'analyzer',
  version: '0.1.0',
  data_types: ['ip'],
  description: 'Check an IP/CIDR against AbuseIPDB.',
  manifest: {
    config: { check_tlp: true, max_tlp: 2 },
    configurationItems: [
      {
        name: 'key',
        description: 'API key',
        type: 'string',
        required: true,
      },
      {
        name: 'days',
        description: 'Lookback window',
        type: 'integer',
        required: false,
        defaultValue: 30,
      },
    ],
  },
  available: true,
  max_runtime_seconds: 30,
  enabled: false,
  settings: { days: 14 },
  has_secrets: true,
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

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <ConnectorsPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => [connectorDto],
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.post).mockImplementation((input) => {
    if (String(input).endsWith('/config/test')) {
      return {
        json: async () => ({
          ok: true,
          message: 'Required connector configuration is present.',
        }),
      } satisfies JsonResponse as ReturnType<typeof api.post>
    }
    return {
      json: async () => ({ ...connectorDto, enabled: true }),
    } satisfies JsonResponse as ReturnType<typeof api.post>
  })
  vi.mocked(api.put).mockReturnValue({
    json: async () => ({ ...connectorDto, settings: { days: 7 } }),
  } satisfies JsonResponse as ReturnType<typeof api.put>)
})

afterEach(cleanup)

describe('ConnectorsPage', () => {
  test('renders the backend connector catalog and toggles enablement', async () => {
    render(<Harness />)

    expect(await screen.findByText('AbuseIPDB')).toBeDefined()
    expect(screen.getByText('v0.1.0')).toBeDefined()
    expect(screen.getByText('ip')).toBeDefined()
    expect(screen.getByText('disabled')).toBeDefined()

    fireEvent.click(screen.getByRole('switch', { name: 'AbuseIPDB enabled' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('connectors/abuseipdb/enable'),
    )
  })

  test('shows an error instead of enabling when required config is missing', async () => {
    vi.mocked(api.get).mockReturnValue({
      json: async () => [
        {
          ...connectorDto,
          settings: {},
          has_secrets: false,
        },
      ],
    } satisfies JsonResponse as ReturnType<typeof api.get>)
    render(<Harness />)

    fireEvent.click(
      await screen.findByRole('switch', { name: 'AbuseIPDB enabled' }),
    )

    await screen.findByText('Configure AbuseIPDB before enabling it. Missing: key')
    expect(api.post).not.toHaveBeenCalledWith('connectors/abuseipdb/enable')
  })

  test('tests stored connector credentials through the backend', async () => {
    render(<Harness />)

    fireEvent.click((await screen.findAllByRole('button', { name: 'Configure' }))[0])

    const drawer = await screen.findByRole('dialog', {
      name: /configure abuseipdb/i,
    })
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Test credentials' }),
    )

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('connectors/abuseipdb/config/test'),
    )
  })

  test('configures settings and replacement secrets through the backend', async () => {
    render(<Harness />)

    fireEvent.click((await screen.findAllByRole('button', { name: 'Configure' }))[0])

    const drawer = await screen.findByRole('dialog', {
      name: /configure abuseipdb/i,
    })
    expect(within(drawer).getAllByText('Secret stored').length).toBeGreaterThan(0)

    fireEvent.change(within(drawer).getByLabelText('key'), {
      target: { value: 'new-secret' },
    })
    fireEvent.change(within(drawer).getByLabelText('days'), {
      target: { value: '7' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save config' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('connectors/abuseipdb/config', {
        json: {
          settings: { days: 7 },
          secrets: { key: 'new-secret' },
        },
      }),
    )
  })
})
