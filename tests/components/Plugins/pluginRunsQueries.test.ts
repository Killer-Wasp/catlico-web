import { fetchPluginRuns, cancelPluginRun, retryFailedRuns, clearFinishedRuns, pluginRunsQueryOptions, pluginRunDetailQueryOptions } from '#/components/Plugins/pluginRuns'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const RUN_DTO = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  event_id: 'evt-1',
  event_type: 'observable.created',
  organisation_id: 'org-1',
  plugin_id: 'virustotal',
  plugin_version_id: 'v-1',
  runner_id: 'runner-1',
  event_object_type: 'observable',
  event_object_id: 'obs-1',
  status: 'success',
  skip_reason: null,
  started_at: '2026-07-10T10:00:00Z',
  ended_at: '2026-07-10T10:00:05Z',
  error: null,
  result_summary: { scanned: 15, malicious: 0 },
  operation_count: 1,
  created_at: '2026-07-10T09:59:00Z',
}

const page = <T>(items: T[]) => ({ items, total: items.length, skip: 0, limit: 200 })

// ── Tests ───────────────────────────────────────────────────────────────────

describe('plugin runs queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  test('fetches and maps plugin runs', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => page([RUN_DTO]),
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const { runs, total } = await fetchPluginRuns()

    expect(total).toBe(1)
    expect(runs).toHaveLength(1)
    const r = runs[0]!
    expect(r.id).toBe(RUN_DTO.id)
    expect(r.eventId).toBe('evt-1')
    expect(r.eventType).toBe('observable.created')
    expect(r.pluginId).toBe('virustotal')
    expect(r.runnerId).toBe('runner-1')
    expect(r.status).toBe('success')
    expect(r.eventObjectType).toBe('observable')
    expect(r.eventObjectId).toBe('obs-1')
    expect(r.operationCount).toBe(1)
    expect(r.resultSummary).toEqual({ scanned: 15, malicious: 0 })
  })

  test('maps all status values correctly', async () => {
    const statuses = ['queued', 'accepted', 'running', 'success', 'failure', 'timeout', 'cancelled', 'cancelling', 'skipped']
    const dtos = statuses.map((s) => ({ ...RUN_DTO, status: s }))
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => page(dtos),
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const { runs } = await fetchPluginRuns()
    expect(runs.map((r) => r.status)).toEqual(statuses)
  })

  test('maps unknown status to failure', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => page([{ ...RUN_DTO, status: 'garbled' }]),
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const { runs } = await fetchPluginRuns()
    expect(runs[0]!.status).toBe('failure')
  })

  test('maps skip reason as-is', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => page([{ ...RUN_DTO, status: 'skipped', skip_reason: 'fresh_result' }]),
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const { runs } = await fetchPluginRuns()
    expect(runs[0]!.skipReason).toBe('fresh_result')
  })

  test('accepts a bare list response (the backend does not wrap in a page)', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [RUN_DTO, { ...RUN_DTO, id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff' }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const { runs, total } = await fetchPluginRuns()
    expect(total).toBe(2)
    expect(runs).toHaveLength(2)
  })

  test('retryFailedRuns reads the backend "retried" count', async () => {
    vi.mocked(api.post).mockImplementation(() => ({
      json: async () => ({ retried: 4 }),
    }) satisfies JsonResponse as ReturnType<typeof api.post>)

    expect(await retryFailedRuns()).toBe(4)
  })

  test('clearFinishedRuns reads the backend "cleared" count', async () => {
    let postedUrl = ''
    vi.mocked(api.post).mockImplementation((input) => {
      postedUrl = String(input)
      return { json: async () => ({ cleared: 7 }) } satisfies JsonResponse as ReturnType<typeof api.post>
    })

    expect(await clearFinishedRuns()).toBe(7)
    expect(postedUrl).toBe('plugin-runs/clear-finished')
  })

  test('cancel run posts to the correct endpoint', async () => {
    let postedUrl = ''
    vi.mocked(api.post).mockImplementation((input) => {
      postedUrl = String(input)
      return { json: async () => ({}) } as JsonResponse as ReturnType<typeof api.post>
    })

    await cancelPluginRun('run-1')
    expect(postedUrl).toBe('plugin-runs/run-1/cancel')
  })

  test('detail query key includes id', () => {
    expect(pluginRunDetailQueryOptions('run-9').queryKey).toEqual([
      'plugin-runs',
      'detail',
      'run-9',
    ])
  })

  test('list query key includes filters', () => {
    const key = pluginRunsQueryOptions({ status: 'running', limit: 50 }).queryKey
    expect(key).toEqual(['plugin-runs', 'list', { status: 'running', limit: 50, tokenFilters: undefined }])
  })
})
