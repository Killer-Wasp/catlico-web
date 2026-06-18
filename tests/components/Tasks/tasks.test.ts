import {
  advanceTaskStatus,
  allocateNextTaskId,
  filterTasksByStatus,
  initialTasks,
} from '#/components/Tasks/tasks'
import { describe, expect, test } from 'vitest'

describe('tasks data helpers', () => {
  test('filters open tasks without completed or cancelled work', () => {
    const openTasks = filterTasksByStatus(initialTasks, 'open')

    expect(openTasks).toHaveLength(17)
    expect(openTasks.every((task) => task.status !== 'completed')).toBe(true)
    expect(openTasks.every((task) => task.status !== 'cancelled')).toBe(true)
  })

  test('advances active task statuses through the queue', () => {
    expect(advanceTaskStatus('waiting')).toBe('inprogress')
    expect(advanceTaskStatus('inprogress')).toBe('completed')
    expect(advanceTaskStatus('completed')).toBe('completed')
    expect(advanceTaskStatus('cancelled')).toBe('cancelled')
  })

  test('uses case-scoped task ids instead of generated uuid-style ids', () => {
    expect(
      initialTasks.every((task) =>
        task.id.startsWith(`T-${task.caseId.replace('#', '')}-`),
      ),
    ).toBe(true)
    expect(initialTasks.map((task) => task.id)).not.toContain('task-001')
  })

  test('allocates the next task id without reusing deleted sequence numbers', () => {
    expect(
      allocateNextTaskId(
        [
          { id: 'T-1843-1', caseId: '#1843' },
          { id: 'T-1843-4', caseId: '#1843' },
          { id: 'T-1842-12', caseId: '#1842' },
        ],
        '#1843',
      ),
    ).toBe('T-1843-5')
  })
})
