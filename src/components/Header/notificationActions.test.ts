import { describe, expect, test, vi } from 'vitest'
import type { UserNotification } from './notificationsQueries'
import { activateNotification } from './notificationActions'

function makeNotification(
  overrides: Partial<UserNotification> = {},
): UserNotification {
  return {
    id: 'n1',
    event_type: 'case.created',
    title: 'Case created',
    body: '',
    payload: {
      object: { type: 'case', id: '42' },
      context: { type: 'unknown', id: '' },
    },
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function actions() {
  return { markRead: vi.fn(), navigate: vi.fn(), close: vi.fn() }
}

describe('activateNotification', () => {
  test('mappable + unread: marks read, closes, and navigates to the target', () => {
    const a = actions()
    activateNotification(makeNotification(), a)

    expect(a.markRead).toHaveBeenCalledWith('n1')
    expect(a.close).toHaveBeenCalledTimes(1)
    expect(a.navigate).toHaveBeenCalledWith({
      to: '/cases/$caseId/$tab',
      params: { caseId: '42', tab: 'details' },
    })
  })

  test('unmappable payload: marks read only — no navigation, no close', () => {
    const a = actions()
    activateNotification(
      makeNotification({
        id: 'n2',
        payload: {
          object: { type: 'plugin_run', id: 'pr-1' },
          context: { type: 'unknown', id: '' },
        },
      }),
      a,
    )

    expect(a.markRead).toHaveBeenCalledWith('n2')
    expect(a.navigate).not.toHaveBeenCalled()
    expect(a.close).not.toHaveBeenCalled()
  })

  test('already-read + mappable: navigates without re-marking read', () => {
    const a = actions()
    activateNotification(
      makeNotification({ read_at: new Date().toISOString() }),
      a,
    )

    expect(a.markRead).not.toHaveBeenCalled()
    expect(a.navigate).toHaveBeenCalledWith({
      to: '/cases/$caseId/$tab',
      params: { caseId: '42', tab: 'details' },
    })
    expect(a.close).toHaveBeenCalledTimes(1)
  })

  test('task notification: navigates to the parent case Tasks tab', () => {
    const a = actions()
    activateNotification(
      makeNotification({
        event_type: 'task.assigned',
        payload: {
          object: { type: 'task', id: 'T-1234-1' },
          context: { type: 'case', id: '1234' },
        },
      }),
      a,
    )

    expect(a.navigate).toHaveBeenCalledWith({
      to: '/cases/$caseId/$tab',
      params: { caseId: '1234', tab: 'tasks' },
    })
  })
})
