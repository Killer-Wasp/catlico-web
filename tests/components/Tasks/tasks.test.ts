import {
  advanceTaskStatus,
  allocateNextTaskId,
  filterTasksByStatus,
} from '#/components/Tasks/tasks'
import type { Task } from '#/components/Tasks/tasks.types'
import { describe, expect, test } from 'vitest'

describe('tasks data helpers', () => {
  const tasks: Task[] = [
    {
      id: 'T-1842-1',
      title: 'Contain OAuth app',
      description: 'OAuth consent grant',
      kind: 'Contain',
      caseId: '#1842',
      caseSeverity: 'high',
      due: 'today',
      status: 'inprogress',
    },
    {
      id: 'T-1842-2',
      title: 'Publish situation summary',
      description: 'OAuth consent grant',
      kind: 'Comms',
      caseId: '#1842',
      caseSeverity: 'high',
      due: 'tomorrow',
      status: 'waiting',
    },
    {
      id: 'T-1841-1',
      title: 'Close ransomware case',
      description: 'Ransomware activity',
      kind: 'Closeout',
      caseId: '#1841',
      caseSeverity: 'critical',
      due: 'tomorrow',
      status: 'completed',
    },
    {
      id: 'T-1840-1',
      title: 'Cancel duplicate task',
      description: 'Duplicate case',
      kind: 'Planning',
      caseId: '#1840',
      caseSeverity: 'high',
      due: 'later',
      status: 'cancelled',
    },
  ]

  test('filters open tasks without completed or cancelled work', () => {
    const openTasks = filterTasksByStatus(tasks, 'open')

    expect(openTasks).toHaveLength(2)
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
      tasks.every((task) =>
        task.id.startsWith(`T-${task.caseId.replace('#', '')}-`),
      ),
    ).toBe(true)
    expect(tasks.map((task) => task.id)).not.toContain('task-001')
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
