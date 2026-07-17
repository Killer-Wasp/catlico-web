import {
  fetchPluginResults,
  groupResults,
  markdownBody,
  pluginResultKeys,
  pluginResultsQueryOptions,
  resolveRenderMode,
  toPluginResult,
  toVerdict,
} from '#/components/PluginResults/pluginResults'
import type {
  PluginResult,
  PluginResultPublic,
} from '#/components/PluginResults/pluginResults.types'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

function dto(overrides: Partial<PluginResultPublic> = {}): PluginResultPublic {
  return {
    id: 'res-1',
    plugin_run_id: 'run-1',
    organisation_id: 'org-1',
    plugin_id: 'virustotal',
    plugin_version_id: 'v1',
    entity_type: 'observable',
    entity_id: 'obs-1',
    source: 'virustotal',
    verdict: 'malicious',
    confidence: 0.92,
    render_mode: 'json',
    title: 'VT lookup',
    summary: '12 / 93 engines flagged this',
    normalized_data: { positives: 12, total: 93 },
    result_metadata: { foo: 'bar' },
    attachments: [
      {
        file_ref: 'file-1',
        filename: 'report.pdf',
        content_type: 'application/pdf',
        size: 2048,
        sha256: 'abc',
      },
    ],
    fingerprint: 'fp-1',
    expires_at: null,
    created_at: '2026-07-10T10:00:00Z',
    stale: false,
    latest: true,
    raw_data: { vendor: 'payload' },
    ...overrides,
  }
}

function domain(overrides: Partial<PluginResult> = {}): PluginResult {
  return { ...toPluginResult(dto()), ...overrides }
}

describe('toPluginResult', () => {
  test('maps every field from the DTO', () => {
    const result = toPluginResult(dto())
    expect(result).toEqual({
      id: 'res-1',
      pluginRunId: 'run-1',
      organisationId: 'org-1',
      pluginId: 'virustotal',
      pluginVersionId: 'v1',
      entityType: 'observable',
      entityId: 'obs-1',
      source: 'virustotal',
      verdict: 'malicious',
      confidence: 0.92,
      renderMode: 'json',
      title: 'VT lookup',
      summary: '12 / 93 engines flagged this',
      normalizedData: { positives: 12, total: 93 },
      resultMetadata: { foo: 'bar' },
      attachments: [
        {
          fileRef: 'file-1',
          filename: 'report.pdf',
          contentType: 'application/pdf',
          size: 2048,
          sha256: 'abc',
        },
      ],
      fingerprint: 'fp-1',
      expiresAt: null,
      createdAt: '2026-07-10T10:00:00Z',
      stale: false,
      latest: true,
      rawData: { vendor: 'payload' },
    })
  })

  test('preserves the server-computed stale flag', () => {
    expect(toPluginResult(dto({ stale: true })).stale).toBe(true)
    expect(toPluginResult(dto({ stale: false })).stale).toBe(false)
  })

  test('defaults missing raw_data / null confidence', () => {
    const result = toPluginResult(
      dto({ raw_data: undefined, confidence: null, attachments: [] }),
    )
    expect(result.rawData).toBeNull()
    expect(result.confidence).toBeNull()
    expect(result.attachments).toEqual([])
  })
})

describe('toVerdict', () => {
  test('passes through the controlled vocabulary', () => {
    for (const v of ['unknown', 'info', 'benign', 'suspicious', 'malicious', 'error']) {
      expect(toVerdict(v)).toBe(v)
    }
  })

  test('coerces null / unknown values to unknown', () => {
    expect(toVerdict(null)).toBe('unknown')
    expect(toVerdict(undefined)).toBe('unknown')
    expect(toVerdict('weird')).toBe('unknown')
  })
})

describe('resolveRenderMode', () => {
  test('supported modes pass through', () => {
    expect(resolveRenderMode('markdown')).toBe('markdown')
    expect(resolveRenderMode('json')).toBe('json')
    expect(resolveRenderMode('table')).toBe('table')
    expect(resolveRenderMode('key_value')).toBe('key_value')
  })

  test('unsupported / unknown modes fall back to json', () => {
    expect(resolveRenderMode('map')).toBe('json')
    expect(resolveRenderMode('timeline')).toBe('json')
    expect(resolveRenderMode('finding_list')).toBe('json')
    expect(resolveRenderMode('nonsense')).toBe('json')
  })
})

describe('markdownBody', () => {
  test('reads markdown from normalized_data.markdown', () => {
    const r = domain({ normalizedData: { markdown: '# Title' } })
    expect(markdownBody(r)).toBe('# Title')
  })

  test('reads content / body keys as fallbacks', () => {
    expect(markdownBody(domain({ normalizedData: { content: 'c' } }))).toBe('c')
    expect(markdownBody(domain({ normalizedData: { body: 'b' } }))).toBe('b')
  })

  test('falls back to summary text when no markdown key', () => {
    const r = domain({ normalizedData: { positives: 1 }, summary: 'plain summary' })
    expect(markdownBody(r)).toBe('plain summary')
  })

  test('returns null when nothing renderable', () => {
    const r = domain({ normalizedData: null, summary: null })
    expect(markdownBody(r)).toBeNull()
  })
})

describe('groupResults', () => {
  test('groups by plugin then source, latest first with history', () => {
    // Newest-first input, as the API guarantees.
    const results: PluginResult[] = [
      domain({ id: 'a3', pluginId: 'vt', source: 'vt', createdAt: '2026-07-10T12:00:00Z' }),
      domain({ id: 'a2', pluginId: 'vt', source: 'vt', createdAt: '2026-07-09T12:00:00Z' }),
      domain({ id: 'a1', pluginId: 'vt', source: 'vt', createdAt: '2026-07-08T12:00:00Z' }),
      domain({ id: 'b1', pluginId: 'vt', source: 'community', createdAt: '2026-07-07T12:00:00Z' }),
      domain({ id: 'c1', pluginId: 'geoip', source: 'maxmind', createdAt: '2026-07-06T12:00:00Z' }),
    ]
    const groups = groupResults(results)

    expect(groups.map((g) => g.pluginId)).toEqual(['vt', 'geoip'])

    const vt = groups[0]
    expect(vt.sources.map((s) => s.source)).toEqual(['vt', 'community'])
    const vtSource = vt.sources[0]
    expect(vtSource.latest.id).toBe('a3')
    expect(vtSource.history.map((r) => r.id)).toEqual(['a2', 'a1'])
    expect(vt.sources[1].latest.id).toBe('b1')
    expect(vt.sources[1].history).toEqual([])

    const geoip = groups[1]
    expect(geoip.sources[0].latest.id).toBe('c1')
  })

  test('empty input yields no groups', () => {
    expect(groupResults([])).toEqual([])
  })
})

describe('query layer', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  test('stable, entity-scoped query key', () => {
    expect(pluginResultKeys.list('observable', 'obs-1')).toEqual([
      'plugin-results',
      'observable',
      'obs-1',
    ])
    expect(pluginResultsQueryOptions('case', '42').queryKey).toEqual([
      'plugin-results',
      'case',
      '42',
    ])
  })

  test('fetches from the right endpoint per entity type and maps', async () => {
    const urls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      urls.push(String(input))
      return { json: async () => [dto()] } satisfies JsonResponse as ReturnType<
        typeof api.get
      >
    })

    const obs = await fetchPluginResults('observable', 'obs-1')
    await fetchPluginResults('case', '42')
    await fetchPluginResults('alert', '9')

    expect(urls).toEqual([
      'observables/obs-1/plugin-results',
      'cases/42/plugin-results',
      'alerts/9/plugin-results',
    ])
    expect(obs).toHaveLength(1)
    expect(obs[0].pluginId).toBe('virustotal')
  })
})
