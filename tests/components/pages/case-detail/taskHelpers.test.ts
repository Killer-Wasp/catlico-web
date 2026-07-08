import type { CaseDetailTask } from '#/components/Cases/caseDetails.types'
import { taskMeta } from '#/components/pages/case-detail/taskHelpers'
import { describe, expect, test } from 'vitest'

const baseTask: CaseDetailTask = {
  id: 'T-2-1',
  apiId: 1,
  caseId: 2,
  title: 'Isolate affected hosts from network',
  group: 'Contain',
  status: 'completed',
  assignee: 'Unassigned',
  flagged: false,
  due: null,
  start: null,
  end: null,
  description: '',
  logs: 0,
}

describe('taskMeta', () => {
  test('does not expose UUID assignee identifiers', () => {
    expect(
      taskMeta({
        ...baseTask,
        assignee: '80043efc-5402-4e35-9d7c-edf453efeb2f',
      }),
    ).toBe('Contain')
  })

  test('keeps human-readable assignees and log counts', () => {
    expect(taskMeta({ ...baseTask, assignee: 'A. Analyst', logs: 2 })).toBe(
      'Contain · A. Analyst · 2 logs',
    )
  })
})
