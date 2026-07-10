import { fetchPluginRunners, fetchPluginRunner, createPluginRunner, triggerHealthCheck, triggerSync, runnerKeys, pluginRunnersQueryOptions } from '#/components/Plugins/pluginRunners'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const RUNNER_DTO = {
  id: 'runner-1',
  name: 'sandbox-east',
  base_url: 'https://runner-1.example.com',
  status: 'healthy',
  version: '0.3.0',
  isolation_mode: 'gvisor',
  last_health_at: '2026-07-10T09:00:00Z',
  last_heartbeat_at: '2026-07-10T10:00:05Z',
  created_at: '2026-07-01T00:00:00Z',
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('plugin runners queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  test('fetches and maps plugin runners', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [RUNNER_DTO],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const runners = await fetchPluginRunners()

    expect(runners).toHaveLength(1)
    const r = runners[0]!
    expect(r.id).toBe('runner-1')
    expect(r.name).toBe('sandbox-east')
    expect(r.baseUrl).toBe('https://runner-1.example.com')
    expect(r.status).toBe('healthy')
    expect(r.version).toBe('0.3.0')
    expect(r.isolationMode).toBe('gvisor')
    expect(r.lastHealthAt).toBe('2026-07-10T09:00:00Z')
    expect(r.lastHeartbeatAt).toBe('2026-07-10T10:00:05Z')
  })

  test('maps unhealthy status', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [{ ...RUNNER_DTO, status: 'unhealthy' }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const runners = await fetchPluginRunners()
    expect(runners[0]!.status).toBe('unhealthy')
  })

  test('maps offline status', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [{ ...RUNNER_DTO, status: 'offline' }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const runners = await fetchPluginRunners()
    expect(runners[0]!.status).toBe('offline')
  })

  test('maps unknown status to offline', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [{ ...RUNNER_DTO, status: 'broken' }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const runners = await fetchPluginRunners()
    expect(runners[0]!.status).toBe('offline')
  })

  test('fetches a single runner by id', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      expect(String(input)).toBe('plugin-runners/runner-1')
      return {
        json: async () => RUNNER_DTO,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const runner = await fetchPluginRunner('runner-1')
    expect(runner.id).toBe('runner-1')
  })

  test('creates a runner and returns enrollment token', async () => {
    const tokenResponse = {
      id: 'runner-new',
      name: 'runner-new',
      status: 'healthy',
      enrollment_state: 'pending',
      enrollment_token: 'cat_enr_abc123',
      enrollment_token_expires_at: '2026-07-10T11:00:00Z',
    }
    let calledWith: unknown
    vi.mocked(api.post).mockImplementation((_input, opts) => {
      calledWith = (opts as { json: unknown }).json
      return { json: async () => tokenResponse } as JsonResponse as ReturnType<typeof api.post>
    })

    const result = await createPluginRunner({ id: 'runner-new' })
    expect(result.enrollment_token).toBe('cat_enr_abc123')
    expect(result.enrollment_state).toBe('pending')
    expect(calledWith).toEqual({ id: 'runner-new' })
  })

  test('health-check POST hits the correct endpoint', async () => {
    let url = ''
    vi.mocked(api.post).mockImplementation((input) => {
      url = String(input)
      return { json: async () => ({}) } as JsonResponse as ReturnType<typeof api.post>
    })

    await triggerHealthCheck('runner-x')
    expect(url).toBe('plugin-runners/runner-x/health-check')
  })

  test('sync POST hits the correct endpoint', async () => {
    let url = ''
    vi.mocked(api.post).mockImplementation((input) => {
      url = String(input)
      return { json: async () => ({}) } as JsonResponse as ReturnType<typeof api.post>
    })

    await triggerSync('runner-x')
    expect(url).toBe('plugin-runners/runner-x/sync')
  })

  test('runners list query key is stable', () => {
    expect(pluginRunnersQueryOptions().queryKey).toEqual([
      'plugin-runners',
      'list',
      undefined,
    ])
  })

  test('runner detail query key includes id', () => {
    expect(runnerKeys.detail('r-9')).toEqual([
      'plugin-runners',
      'detail',
      'r-9',
    ])
  })

  test('stats query key includes window', () => {
    expect(runnerKeys.stats('r-9', '30d')).toEqual([
      'plugin-runners',
      'detail',
      'r-9',
      'stats',
      '30d',
    ])
  })
})
