import type {
  ConnectorJob,
  ConnectorJobStatus,
} from '#/components/Connectors/connectorJobs.types'
import {
  analyzerJobKeys,
  analyzerJobsQueryOptions,
  cancelAnalyzerJob,
  clearFinishedAnalyzerJobs,
  countConnectorJobsByTab,
  type EnrichmentJobRow,
  fetchAnalyzerJobs,
  filterConnectorJobsByTab,
  retryFailedAnalyzerJobs,
  toConnectorJob,
} from '#/components/Connectors/connectorJobs'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

type JsonResponse = { json: () => Promise<unknown> }

const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 200,
})

function job(status: ConnectorJobStatus): ConnectorJob {
  return {
    id: status,
    ref: `J-${status}`,
    observableId: 'obs',
    observableType: 'ip',
    observable: '1.2.3.4',
    plugin: 'GeoIP',
    status,
  }
}

const sampleRow: EnrichmentJobRow = {
  id: 'd4f6a1b2-1111-2222-3333-444455556666',
  observable_id: 'obs-1',
  connector_name: 'abuseipdb',
  connector_display_name: 'AbuseIPDB',
  connector_version: '1.0.0',
  data_type: 'ip',
  data: '203.0.113.47',
  status: 'success',
  verdict: 'malicious',
  error: null,
  from_cache: false,
  attempts: 1,
  queued_at: '2026-06-21T10:31:00Z',
  started_at: '2026-06-21T10:31:02Z',
  ended_at: '2026-06-21T10:31:02.800Z',
}

describe('analyzer job mapping', () => {
  test('maps a backend row onto the queue view (verdict, ref, duration)', () => {
    const mapped = toConnectorJob(sampleRow)
    expect(mapped).toMatchObject({
      id: 'd4f6a1b2-1111-2222-3333-444455556666',
      ref: 'J-d4f6a1',
      observableId: 'obs-1',
      observableType: 'ip',
      observable: '203.0.113.47',
      plugin: 'AbuseIPDB',
      status: 'success',
      verdict: 'MALICIOUS',
      duration: '0.8s',
    })
    expect(mapped.cached).toBeUndefined()
  })

  test('translates a leased job to running and surfaces the cache flag', () => {
    const mapped = toConnectorJob({
      ...sampleRow,
      status: 'leased',
      verdict: null,
      from_cache: true,
      ended_at: null,
    })
    expect(mapped.status).toBe('running')
    expect(mapped.verdict).toBeUndefined()
    expect(mapped.cached).toBe(true)
    expect(mapped.duration).toBeUndefined()
  })

  test('leaves a queued job without a started time', () => {
    const mapped = toConnectorJob({
      ...sampleRow,
      status: 'queued',
      started_at: null,
      ended_at: null,
    })
    expect(mapped.status).toBe('queued')
    expect(mapped.started).toBeUndefined()
  })
})

describe('analyzer job queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  test('fetches the org queue and maps every row', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('enrichment-jobs?limit=200')
      return {
        json: async () => page([sampleRow]),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const jobs = await fetchAnalyzerJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].plugin).toBe('AbuseIPDB')
  })

  test('cancel posts to the job cancel endpoint', async () => {
    vi.mocked(api.post).mockReturnValue(
      { json: async () => ({}) } as ReturnType<typeof api.post>,
    )
    await cancelAnalyzerJob('job-9')
    expect(api.post).toHaveBeenCalledWith('enrichment-jobs/job-9/cancel')
  })

  test('retry and clear return their counts', async () => {
    vi.mocked(api.post).mockImplementation((input) => {
      const requeued = String(input) === 'enrichment-jobs/retry-failed'
      return {
        json: async () => (requeued ? { requeued: 3 } : { cleared: 5 }),
      } satisfies JsonResponse as ReturnType<typeof api.post>
    })
    expect(await retryFailedAnalyzerJobs()).toBe(3)
    expect(await clearFinishedAnalyzerJobs()).toBe(5)
  })

  test('keys the list and detail queries stably', () => {
    expect(analyzerJobKeys.list()).toEqual(['analyzer-jobs', 'list'])
    expect(analyzerJobKeys.detail('abc')).toEqual([
      'analyzer-jobs',
      'detail',
      'abc',
    ])
  })

  test('polls the org queue on a slower background cadence', () => {
    expect(analyzerJobsQueryOptions().refetchInterval).toBe(30_000)
  })
})

describe('queue tab helpers', () => {
  const jobs = [
    job('queued'),
    job('running'),
    job('running'),
    job('success'),
    job('failure'),
  ]

  test('filters jobs by status tab', () => {
    expect(filterConnectorJobsByTab(jobs, 'all')).toHaveLength(5)
    expect(filterConnectorJobsByTab(jobs, 'running')).toHaveLength(2)
    expect(filterConnectorJobsByTab(jobs, 'queued')).toHaveLength(1)
  })

  test('counts jobs by status tab', () => {
    expect(countConnectorJobsByTab(jobs)).toEqual({
      all: 5,
      queued: 1,
      running: 2,
      success: 1,
      failure: 1,
    })
  })
})
