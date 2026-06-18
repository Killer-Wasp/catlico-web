import {
  getCaseDetail,
  getCaseRouteId,
  normalizeCaseId,
} from './caseDetailsData'
import { describe, expect, test } from 'vitest'

describe('case detail data helpers', () => {
  test('normalizes route ids to case ids', () => {
    expect(normalizeCaseId('1842')).toBe('#1842')
    expect(normalizeCaseId('#1842')).toBe('#1842')
  })

  test('creates route ids from case ids', () => {
    expect(getCaseRouteId('#1842')).toBe('1842')
  })

  test('loads the prototype OAuth case details', () => {
    const detail = getCaseDetail('1842')

    expect(detail.id).toBe('#1842')
    expect(detail.title).toBe(
      'OAuth consent grant — privileged account compromise',
    )
    expect(detail.pap).toBe(2)
    expect(detail.businessUnit).toBe('Corporate IT')
    expect(detail.customFields).toEqual([
      ['Campaign ID', 'BILL-2026-Q2'],
      ['Affected users', '3'],
      ['Data classification', 'Confidential'],
    ])
    expect(detail.linkedAlerts.map((alert) => alert.id)).toEqual([
      'AL-9119',
      'AL-9102',
    ])
    expect(detail.responders).toHaveLength(4)
    expect(detail.ttps).toEqual([
      'T1528',
      'T1566.002',
      'T1114.003',
      'T1098.005',
    ])
  })

  test('falls back to the first case for unknown route ids', () => {
    expect(getCaseDetail('not-a-case').id).toBe('#1842')
  })
})
