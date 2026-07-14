import { describe, expect, test } from 'vitest'
import { hitRoute } from '#/lib/search'

describe('hitRoute', () => {
  test('case hit -> case page', () => {
    expect(hitRoute('case', { id: 412 })).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '412', tab: 'details' },
    })
  })

  test('alert hit -> alert page', () => {
    expect(hitRoute('alert', { id: 9 })).toEqual({
      to: '/alerts/$alertId',
      params: { alertId: '9' },
    })
  })

  test('case observable -> case observables tab', () => {
    expect(hitRoute('observable', { case_id: 412, alert_id: null })).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '412', tab: 'observables' },
    })
  })

  test('alert observable -> alert page', () => {
    expect(hitRoute('observable', { case_id: null, alert_id: 9 })).toEqual({
      to: '/alerts/$alertId',
      params: { alertId: '9' },
    })
  })

  test('task -> case tasks tab', () => {
    expect(hitRoute('task', { case_id: 412 })).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '412', tab: 'tasks' },
    })
  })

  test('case comment -> case comments tab with ?comment= deep-link', () => {
    expect(
      hitRoute('comment', {
        id: 'c-1',
        entity_type: 'case',
        entity_id: '412',
      }),
    ).toEqual({
      to: '/cases/$caseId/$tab',
      params: { caseId: '412', tab: 'comments' },
      search: { comment: 'c-1' },
    })
  })

  test('alert comment -> alert page', () => {
    expect(
      hitRoute('comment', { entity_type: 'alert', entity_id: '9' }),
    ).toEqual({
      to: '/alerts/$alertId',
      params: { alertId: '9' },
    })
  })
})
