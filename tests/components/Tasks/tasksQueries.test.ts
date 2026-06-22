import type { TaskQueuePublic } from '#/components/Tasks/tasksQueries'
import {
  fetchTasks,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const taskDto: TaskQueuePublic = {
  id: '6f32934a-0119-40c6-8680-26ded03dd669',
  public_id: 'T-1842-4',
  case_id: 1842,
  organisation_id: 'org-a',
  title: 'Revoke refresh tokens',
  group: 'Contain',
  description: 'OAuth consent grant',
  status: 'InProgress',
  assignee_id: '705786fe-73ca-4d88-87b7-5df54bdd4b1a',
  order: 0,
  flagged: true,
  start_date: null,
  due_date: '2026-06-21T06:00:00Z',
  end_date: null,
  created_at: '2026-06-21T01:00:00Z',
  updated_at: null,
  case_title: 'OAuth consent grant',
  case_severity: 3,
  assignee_email: 'analyst-a@test.com',
}

describe('tasks API queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.patch).mockReset()
  })

  test('fetches the org task queue and maps backend context for the table', async () => {
    vi.mocked(api.get).mockImplementation((input, options) => {
      expect(String(input)).toBe('tasks/')
      expect(options).toEqual({ searchParams: { limit: '200', skip: '0' } })
      return {
        json: async () => ({
          items: [taskDto],
          total: 1,
          skip: 0,
          limit: 200,
        }),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const result = await fetchTasks({ limit: 200, skip: 0 })

    expect(result.total).toBe(1)
    expect(result.tasks[0]).toMatchObject({
      id: 'T-1842-4',
      apiId: '6f32934a-0119-40c6-8680-26ded03dd669',
      title: 'Revoke refresh tokens',
      description: 'OAuth consent grant',
      kind: 'Contain',
      flagged: true,
      caseId: '#1842',
      caseSeverity: 'high',
      assignee: 'analyst-a@test.com',
      due: expect.stringContaining('21 Jun'),
      status: 'inprogress',
    })
  })

  test('patches task status using backend enum values and maps the response', async () => {
    vi.mocked(api.patch).mockImplementation((input, options) => {
      expect(String(input)).toBe('tasks/6f32934a-0119-40c6-8680-26ded03dd669')
      expect(options).toEqual({ json: { status: 'Completed' } })
      return {
        json: async () => ({
          id: taskDto.id,
          public_id: taskDto.public_id,
          case_id: taskDto.case_id,
          organisation_id: taskDto.organisation_id,
          title: taskDto.title,
          group: taskDto.group,
          description: taskDto.description,
          status: 'Completed',
          assignee_id: taskDto.assignee_id,
          order: taskDto.order,
          flagged: taskDto.flagged,
          start_date: taskDto.start_date,
          due_date: taskDto.due_date,
          end_date: '2026-06-21T06:30:00Z',
          created_at: taskDto.created_at,
          updated_at: '2026-06-21T06:30:00Z',
        }),
      } satisfies JsonResponse as ReturnType<typeof api.patch>
    })

    const task = await updateTaskStatus({
      apiId: '6f32934a-0119-40c6-8680-26ded03dd669',
      status: 'completed',
    })

    expect(task.id).toBe('T-1842-4')
    expect(task.status).toBe('completed')
  })

  test('uses a stable query key', () => {
    expect(tasksQueryOptions({ limit: 50, skip: 10 }).queryKey).toEqual([
      'tasks',
      'list',
      { limit: 50, skip: 10 },
    ])
  })
})
