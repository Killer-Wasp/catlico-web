// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  RECENTLY_VIEWED_KEY,
  getRecentlyViewed,
  recordRecentlyViewed,
} from './recentlyViewed'
import type { RecentlyViewedEntry } from './recentlyViewed'

const entry = (
  overrides: Partial<RecentlyViewedEntry> = {},
): RecentlyViewedEntry => ({
  type: 'case',
  id: '1',
  label: 'Case one',
  route: { to: '/cases/$caseId/$tab', params: { caseId: '1', tab: 'details' } },
  ...overrides,
})

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('recentlyViewed', () => {
  test('returns [] when nothing recorded', () => {
    expect(getRecentlyViewed()).toEqual([])
  })

  test('records an entry and reads it back', () => {
    recordRecentlyViewed(entry())
    expect(getRecentlyViewed()).toEqual([entry()])
  })

  test('most-recent-first ordering', () => {
    recordRecentlyViewed(entry({ id: '1', label: 'A' }))
    recordRecentlyViewed(entry({ id: '2', label: 'B' }))
    const got = getRecentlyViewed()
    expect(got.map((e) => e.id)).toEqual(['2', '1'])
  })

  test('dedupes by type+id, moving the repeat to the front', () => {
    recordRecentlyViewed(entry({ id: '1' }))
    recordRecentlyViewed(entry({ id: '2' }))
    recordRecentlyViewed(entry({ id: '1', label: 'updated' }))
    const got = getRecentlyViewed()
    expect(got.map((e) => e.id)).toEqual(['1', '2'])
    expect(got[0].label).toBe('updated')
  })

  test('same id but different type is not a dupe', () => {
    recordRecentlyViewed(entry({ type: 'case', id: '1' }))
    recordRecentlyViewed(entry({ type: 'alert', id: '1' }))
    expect(getRecentlyViewed()).toHaveLength(2)
  })

  test('caps the buffer at 8, dropping the oldest', () => {
    for (let i = 1; i <= 12; i++) {
      recordRecentlyViewed(entry({ id: String(i) }))
    }
    const got = getRecentlyViewed()
    expect(got).toHaveLength(8)
    // newest (12) first, oldest kept is 5
    expect(got.map((e) => e.id)).toEqual([
      '12',
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
    ])
  })

  test('tolerates malformed JSON without throwing', () => {
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, '{not valid json')
    expect(() => getRecentlyViewed()).not.toThrow()
    expect(getRecentlyViewed()).toEqual([])
  })

  test('tolerates a non-array payload', () => {
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, '{"foo":"bar"}')
    expect(getRecentlyViewed()).toEqual([])
  })

  test('drops individual malformed entries', () => {
    window.localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify([{ id: 'x' }, entry({ id: '9' })]),
    )
    const got = getRecentlyViewed()
    expect(got).toHaveLength(1)
    expect(got[0].id).toBe('9')
  })

  test('recordRecentlyViewed never throws when storage write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => recordRecentlyViewed(entry())).not.toThrow()
  })
})
