import {
  buildConnectorConfigPayload,
  connectorsQueryOptions,
  fetchConnectors,
  filterConnectorsByTab,
  getMissingRequiredConfigItems,
  isSecretConfigItem,
  saveConnectorConfig,
  setConnectorEnabled,
  testConnectorConfig,
} from '#/components/Connectors/connectors'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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

describe('connectors API helpers', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
  })

  test('fetches connectors from the API and maps backend metadata for the cards', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('connectors')
      return {
        json: async () => [connectorDto],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const connectors = await fetchConnectors()

    expect(connectors).toEqual([
      expect.objectContaining({
        id: 'abuseipdb',
        name: 'AbuseIPDB',
        initials: 'AB',
        version: 'v0.1.0',
        kind: 'analyzer',
        observables: ['ip'],
        tlp: 'AMBER',
        enabled: false,
        hasSecrets: true,
        settings: { days: 14 },
        configItems: connectorDto.manifest.configurationItems,
      }),
    ])
  })

  test('filters connectors by catalog tab', async () => {
    const connectors = [
      { id: 'a', kind: 'analyzer', enabled: true },
      { id: 'b', kind: 'responder', enabled: true },
      { id: 'c', kind: 'analyzer', enabled: false },
    ] as Awaited<ReturnType<typeof fetchConnectors>>

    expect(filterConnectorsByTab(connectors, 'all')).toHaveLength(3)
    expect(filterConnectorsByTab(connectors, 'analyzers')).toHaveLength(2)
    expect(filterConnectorsByTab(connectors, 'responders')).toHaveLength(1)
    expect(filterConnectorsByTab(connectors, 'disabled')).toHaveLength(1)
  })

  test('enables and disables connectors through backend mutations', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => ({ ...connectorDto, enabled: true }),
    } satisfies JsonResponse as ReturnType<typeof api.post>)

    await setConnectorEnabled('abuseipdb', true)
    expect(api.post).toHaveBeenCalledWith('connectors/abuseipdb/enable')

    await setConnectorEnabled('abuseipdb', false)
    expect(api.post).toHaveBeenLastCalledWith('connectors/abuseipdb/disable')
  })

  test('splits secret-looking config fields from ordinary settings', () => {
    const payload = buildConnectorConfigPayload(connectorDto.manifest.configurationItems, {
      key: 'new-secret',
      days: 7,
    })

    expect(payload).toEqual({
      settings: { days: 7 },
      secrets: { key: 'new-secret' },
    })
    expect(isSecretConfigItem({ name: 'client_secret', type: 'string' })).toBe(
      true,
    )
    expect(isSecretConfigItem({ name: 'max_records', type: 'integer' })).toBe(
      false,
    )
  })

  test('omits blank secret fields so saved secrets are preserved', () => {
    const payload = buildConnectorConfigPayload(connectorDto.manifest.configurationItems, {
      key: '',
      days: 30,
    })

    expect(payload).toEqual({
      settings: { days: 30 },
      secrets: {},
    })
  })

  test('lists required connector config items missing from stored configuration', () => {
    const missing = getMissingRequiredConfigItems({
      configItems: connectorDto.manifest.configurationItems,
      settings: { days: '' },
      hasSecrets: false,
    })

    expect(missing).toEqual(['key'])
  })

  test('saves connector settings and replacement secrets', async () => {
    vi.mocked(api.put).mockReturnValue({
      json: async () => connectorDto,
    } satisfies JsonResponse as ReturnType<typeof api.put>)

    await saveConnectorConfig('abuseipdb', {
      settings: { days: 7 },
      secrets: { key: 'new-secret' },
    })

    expect(api.put).toHaveBeenCalledWith('connectors/abuseipdb/config', {
      json: {
        settings: { days: 7 },
        secrets: { key: 'new-secret' },
      },
    })
  })

  test('tests stored connector configuration through the backend', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => ({
        ok: true,
        message: 'Required connector configuration is present.',
      }),
    } satisfies JsonResponse as ReturnType<typeof api.post>)

    await expect(testConnectorConfig('abuseipdb')).resolves.toEqual({
      ok: true,
      message: 'Required connector configuration is present.',
    })
    expect(api.post).toHaveBeenCalledWith('connectors/abuseipdb/config/test')
  })

  test('uses a stable connector catalog query key', () => {
    expect(connectorsQueryOptions().queryKey).toEqual([
      'connectors',
      'catalog',
    ])
  })
})
