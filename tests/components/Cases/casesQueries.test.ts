import { fetchCaseDetail } from '#/components/Cases/casesQueries'
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

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 100,
})

describe('case detail queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  test('fetches a case detail by fanning out to backend child-resource endpoints', async () => {
    const calls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      const endpoint = String(input)
      calls.push(endpoint)
      const payloads: Record<string, unknown> = {
        'cases/1842': {
          id: 1842,
          title: 'OAuth consent grant',
          description: 'Investigate consent grant.',
          severity: 3,
          tlp: 2,
          pap: 2,
          status: 'Open',
          flagged: false,
          assignee_id: null,
          assignee_email: null,
          tags: ['identity'],
          tasks: [],
          start_date: null,
          end_date: null,
          summary: null,
          resolution_status: null,
          impact_status: null,
          duplicate_of_case_id: null,
          merged_into: null,
          merged_from: [],
          custom_fields: {},
          created_at: '2026-06-12T09:12:00Z',
          updated_at: null,
        },
        'cases/1842/tasks': page([]),
        'cases/1842/observables': page([]),
        'cases/1842/comments': page([]),
        'cases/1842/activity': page([]),
      }
      return {
        json: async () => payloads[endpoint],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const detail = await fetchCaseDetail('1842')

    expect(calls).toEqual([
      'cases/1842',
      'cases/1842/tasks',
      'cases/1842/observables',
      'cases/1842/comments',
      'cases/1842/activity',
    ])
    expect(detail).toMatchObject({
      id: '#1842',
      title: 'OAuth consent grant',
      assignee: 'Unassigned',
      tasks: [],
      observables: [],
      comments: [],
      timeline: [],
    })
  })
})
