import {
  advanceTaskStatus,
  filterTasksByStatus,
  initialTasks,
} from './tasksData'
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
})
