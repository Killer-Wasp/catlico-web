import { fetchPlugins, fetchPlugin, pluginsQueryOptions, pluginDetailQueryOptions } from '#/components/Plugins/plugins'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

// ── Helpers ─────────────────────────────────────────────────────────────────

const PLUGIN_DTO = {
  id: 'virustotal',
  display_name: 'VirusTotal',
  description: 'Look up observables in VirusTotal',
  manifest: {
    name: 'virustotal',
    version: '2.1.0',
    configuration: [
      { name: 'api_key', type: 'secret', required: true },
      { name: 'max_age_days', type: 'integer', required: false, defaultValue: 30 },
      { name: 'auto_scan', type: 'boolean', required: false, defaultValue: false },
    ],
    triggers: [{ event: ['observable.created'] }],
  },
  available: true,
  runner_id: 'runner-1',
  runner_ids: ['runner-1'],
  enabled: true,
  auto_run_enabled: false,
  auto_apply_actions: ['add_tag'],
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('plugins queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  // ── Catalog (list) ────────────────────────────────────────────────────

  test('fetches and maps plugins from the API', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('plugins')
      return {
        json: async () => [PLUGIN_DTO],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const plugins = await fetchPlugins()

    expect(plugins).toHaveLength(1)
    const p = plugins[0]!
    expect(p.id).toBe('virustotal')
    expect(p.displayName).toBe('VirusTotal')
    expect(p.description).toBe('Look up observables in VirusTotal')
    expect(p.available).toBe(true)
    expect(p.runnerId).toBe('runner-1')
    expect(p.runnerIds).toEqual(['runner-1'])
    expect(p.enabled).toBe(true)
    expect(p.autoRunEnabled).toBe(false)
    expect(p.autoApplyActions).toEqual(['add_tag'])
    expect(p.manifest.version).toBe('2.1.0')
    expect(p.configParams).toHaveLength(3)
    expect(p.configParams[0]!.name).toBe('api_key')
    expect(p.configParams[0]!.type).toBe('secret')
  })

  test('handles empty manifest gracefully', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [{ ...PLUGIN_DTO, manifest: undefined }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const plugins = await fetchPlugins()
    expect(plugins[0]!.manifest).toEqual({})
    expect(plugins[0]!.configParams).toEqual([])
  })

  test('handles empty API response', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const plugins = await fetchPlugins()
    expect(plugins).toHaveLength(0)
  })

  // ── Detail ─────────────────────────────────────────────────────────────

  test('fetches a single plugin by id', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('plugins/virustotal')
      return {
        json: async () => PLUGIN_DTO,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const plugin = await fetchPlugin('virustotal')
    expect(plugin.id).toBe('virustotal')
    expect(plugin.displayName).toBe('VirusTotal')
  })

  // ── Query keys ─────────────────────────────────────────────────────────

  test('catalog query key is stable', () => {
    expect(pluginsQueryOptions().queryKey).toEqual(['plugins', 'catalog'])
  })

  test('detail query key includes id', () => {
    expect(pluginDetailQueryOptions('plugin-1').queryKey).toEqual([
      'plugins',
      'detail',
      'plugin-1',
    ])
  })
})
