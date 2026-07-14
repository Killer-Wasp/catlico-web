import { describe, expect, test } from 'vitest'
import { notificationRoute } from './notificationRoute'

/** Build a minimal envelope with the given object/context refs. */
const envelope = (
  object: { type: string; id?: string } | null,
  context?: { type: string; id?: string },
) => ({
  ...(object ? { object } : {}),
  ...(context ? { context } : {}),
})

describe('notificationRoute', () => {
  test('case → case details tab (object.id is the case PK)', () => {
    expect(
      notificationRoute(envelope({ type: 'case', id: '42' })),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '42', tab: 'details' },
    })
  })

  test('alert → alert drawer route', () => {
    expect(notificationRoute(envelope({ type: 'alert', id: '7' }))).toEqual({
      to: '/alerts/$alertId',
      params: { alertId: '7' },
    })
  })

  test('observable → observables list (no open-by-id param exists)', () => {
    expect(
      notificationRoute(
        envelope({ type: 'observable', id: 'obs-uuid' }, { type: 'unknown' }),
      ),
    ).toEqual({ to: '/observables' })
  })

  test('knowledge_base_page → the KB page route', () => {
    expect(
      notificationRoute(envelope({ type: 'knowledge_base_page', id: 'p9' })),
    ).toEqual({ to: '/knowledge-base/$pageId', params: { pageId: 'p9' } })
  })

  test('task → parent case Tasks tab via context.id (object.id is a public_id)', () => {
    expect(
      notificationRoute(
        envelope({ type: 'task', id: 'T-1234-1' }, { type: 'case', id: '1234' }),
      ),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '1234', tab: 'tasks' },
    })
  })

  test('log → parent case Timeline tab via context.id', () => {
    expect(
      notificationRoute(
        envelope({ type: 'log', id: 'L-5-2' }, { type: 'case', id: '5' }),
      ),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '5', tab: 'timeline' },
    })
  })

  test('comment on a case → case Comments tab, deep-linked to the comment', () => {
    expect(
      notificationRoute(
        envelope(
          { type: 'comment', id: 'c-uuid' },
          { type: 'case', id: '3' },
        ),
      ),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '3', tab: 'comments' },
      search: { comment: 'c-uuid' },
    })
  })

  test('comment on an alert → the parent alert drawer', () => {
    expect(
      notificationRoute(
        envelope({ type: 'comment', id: 'c-uuid' }, { type: 'alert', id: '8' }),
      ),
    ).toEqual({ to: '/alerts/$alertId', params: { alertId: '8' } })
  })

  test('synthesized task.assigned routes via context (object.type stays task)', () => {
    // The `<obj>.assigned` notification reuses the underlying object envelope.
    expect(
      notificationRoute(
        envelope({ type: 'task', id: 'T-9-1' }, { type: 'case', id: '9' }),
      ),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '9', tab: 'tasks' },
    })
  })

  test('synthesized case.mentioned routes to the case (context is unknown)', () => {
    expect(
      notificationRoute(
        envelope({ type: 'case', id: '11' }, { type: 'unknown', id: '' }),
      ),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '11', tab: 'details' },
    })
  })

  test('unknown object type → null', () => {
    expect(
      notificationRoute(envelope({ type: 'plugin_run', id: 'pr-1' })),
    ).toBeNull()
  })

  test('task with no routable context → null', () => {
    expect(
      notificationRoute(envelope({ type: 'task', id: 'T-1-1' }, { type: 'unknown' })),
    ).toBeNull()
  })

  test('missing/empty object → null', () => {
    expect(notificationRoute(envelope(null))).toBeNull()
    expect(notificationRoute({})).toBeNull()
    expect(notificationRoute(null)).toBeNull()
    expect(notificationRoute(undefined)).toBeNull()
  })

  test('case with no id → null', () => {
    expect(notificationRoute(envelope({ type: 'case' }))).toBeNull()
  })
})
