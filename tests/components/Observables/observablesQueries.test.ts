import {
  fetchObservableEnrichments,
  fetchObservables,
  observableEnrichmentsQueryOptions,
  observablesQueryOptions,
} from '#/components/Observables/observablesQueries'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 100,
})

describe('observables queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  test('fetches observables from the API and maps them for the table', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('observables/')
      return {
        json: async () =>
          page([
            {
              id: 'a276a296-3609-4926-b159-b9f506fcd668',
              case_id: 1842,
              alert_id: null,
              observable_type: 'url',
              data: 'hxxps://cdn-au-billing[.]net/invoice.php',
              message: 'URLscan complete',
              tlp: 2,
              ioc: true,
              sighted: false,
              ignore_similarity: false,
              organisation_id: 'org-1',
              created_at: '2026-06-12T09:21:00Z',
              updated_at: null,
            },
            {
              id: 'd9476d0d-9042-4574-9f1f-1f907a1eddd1',
              case_id: null,
              alert_id: 9102,
              observable_type: 'ipv4',
              data: '203.0.113.47',
              message: '',
              tlp: 1,
              ioc: false,
              sighted: true,
              ignore_similarity: false,
              organisation_id: 'org-1',
              created_at: '2026-06-12T09:30:00Z',
              updated_at: null,
            },
          ]),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const result = await fetchObservables()

    expect(result.total).toBe(2)
    expect(result.observables).toEqual([
      {
        id: 'a276a296-3609-4926-b159-b9f506fcd668',
        type: 'url',
        value: 'hxxps://cdn-au-billing[.]net/invoice.php',
        flags: ['ioc'],
        tlp: 2,
        source: '#1842',
        analysis: { analyzer: 'Note', verdict: 'URLscan complete' },
        added: expect.any(String),
      },
      {
        id: 'd9476d0d-9042-4574-9f1f-1f907a1eddd1',
        type: 'ip',
        value: '203.0.113.47',
        flags: ['sighted'],
        tlp: 1,
        source: 'AL-9102',
        added: expect.any(String),
      },
    ])
  })

  test('uses a stable query key', () => {
    expect(observablesQueryOptions().queryKey).toEqual([
      'observables',
      'list',
      { sort: '', order: 'desc', skip: 0, limit: 10 },
    ])
  })

  test('fetches the enrichment overview for an observable', async () => {
    const overview = {
      jobs: [
        {
          id: 'job-1',
          observable_id: 'obs-1',
          connector_name: 'maxmind',
          connector_version: '0.1.0',
          status: 'success',
          verdict: 'info',
          error: null,
          from_cache: false,
          queued_at: '2026-06-12T09:21:00Z',
          ended_at: '2026-06-12T09:21:01Z',
        },
      ],
      tags: [
        {
          connector_name: 'maxmind',
          namespace: 'MaxMind',
          predicate: 'Location',
          value: 'United States',
          level: 'info',
        },
      ],
    }
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('observables/obs-1/enrichments')
      return {
        json: async () => overview,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    expect(await fetchObservableEnrichments('obs-1')).toEqual(overview)
  })

  test('keys enrichment queries by observable id', () => {
    expect(observableEnrichmentsQueryOptions('obs-9').queryKey).toEqual([
      'observables',
      'enrichments',
      'obs-9',
    ])
  })
})
