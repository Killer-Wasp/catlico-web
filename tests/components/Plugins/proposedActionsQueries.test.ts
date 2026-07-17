import { fetchProposedActions, approveProposedAction, rejectProposedAction, proposedActionKeys } from '#/components/Plugins/proposedActions'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const ACTION_DTO = {
  id: 'act-1',
  plugin_id: 'virustotal',
  plugin_run_id: 'run-1',
  action_type: 'add_tag',
  entity_type: 'observable',
  entity_id: 'obs-1',
  payload: { tag: 'malware' },
  status: 'proposed',
  decision_reason: null,
  decided_by: null,
  decided_at: null,
  created_at: '2026-07-10T10:00:00Z',
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('proposed actions queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  test('fetches and maps proposed actions', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [ACTION_DTO],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const actions = await fetchProposedActions()

    expect(actions).toHaveLength(1)
    const a = actions[0]
    expect(a.id).toBe('act-1')
    expect(a.pluginId).toBe('virustotal')
    expect(a.pluginRunId).toBe('run-1')
    expect(a.actionType).toBe('add_tag')
    expect(a.entityType).toBe('observable')
    expect(a.entityId).toBe('obs-1')
    expect(a.payload).toEqual({ tag: 'malware' })
    expect(a.status).toBe('proposed')
  })

  test('maps all action types correctly', async () => {
    const types = ['add_tag', 'create_task', 'append_task_log', 'add_related_observable', 'change_severity_status', 'patch_case_description']
    const dtos = types.map((t) => ({ ...ACTION_DTO, action_type: t }))
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => dtos,
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const actions = await fetchProposedActions()
    expect(actions.map((a) => a.actionType)).toEqual(types)
  })

  test('maps unknown action type to add_tag', async () => {
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [{ ...ACTION_DTO, action_type: 'weird' }],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const actions = await fetchProposedActions()
    expect(actions[0].actionType).toBe('add_tag')
  })

  test('maps all status values', async () => {
    const statuses = ['proposed', 'approved', 'rejected', 'applied', 'failed', 'expired', 'superseded']
    const dtos = statuses.map((s) => ({ ...ACTION_DTO, status: s }))
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => dtos,
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const actions = await fetchProposedActions()
    expect(actions.map((a) => a.status)).toEqual(statuses)
  })

  test('maps decision info when present', async () => {
    const dto = {
      ...ACTION_DTO,
      status: 'approved',
      decision_reason: 'Looks good',
      decided_by: 'admin@example.com',
      decided_at: '2026-07-10T10:05:00Z',
    }
    vi.mocked(api.get).mockImplementation(() => ({
      json: async () => [dto],
    }) satisfies JsonResponse as ReturnType<typeof api.get>)

    const actions = await fetchProposedActions()
    const a = actions[0]
    expect(a.status).toBe('approved')
    expect(a.decisionReason).toBe('Looks good')
    expect(a.decidedBy).toBe('admin@example.com')
    expect(a.decidedAt).toBe('2026-07-10T10:05:00Z')
  })

  test('approve action posts to correct endpoint and remaps', async () => {
    vi.mocked(api.post).mockImplementation((input) => {
      expect(String(input)).toBe('proposed-actions/act-1/approve')
      return {
        json: async () => ({ ...ACTION_DTO, status: 'approved' }),
      } satisfies JsonResponse as ReturnType<typeof api.post>
    })

    const result = await approveProposedAction('act-1')
    expect(result.status).toBe('approved')
  })

  test('reject action posts to correct endpoint and remaps', async () => {
    vi.mocked(api.post).mockImplementation((input) => {
      expect(String(input)).toBe('proposed-actions/act-1/reject')
      return {
        json: async () => ({ ...ACTION_DTO, status: 'rejected' }),
      } satisfies JsonResponse as ReturnType<typeof api.post>
    })

    const result = await rejectProposedAction('act-1')
    expect(result.status).toBe('rejected')
  })

  test('list query filters are serialized', async () => {
    let url = ''
    vi.mocked(api.get).mockImplementation((input) => {
      url = String(input)
      return { json: async () => [] } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    await fetchProposedActions({ entity_type: 'observable', entity_id: 'obs-1' })
    expect(url).toContain('entity_type=observable')
    expect(url).toContain('entity_id=obs-1')
  })

  test('query key is stable', () => {
    expect(proposedActionKeys.list({ entity_id: 'e1' })).toEqual([
      'proposed-actions',
      'list',
      { entity_id: 'e1' },
    ])
  })
})
