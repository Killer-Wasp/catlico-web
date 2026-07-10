import { describe, expect, test } from 'vitest'
import { validateSearchParams } from '#/routes/_app/search'

const PAGE_SIZE = 25
const offsetFor = (page: number) => (page - 1) * PAGE_SIZE

describe('validateSearchParams', () => {
  test('passes through a well-formed query', () => {
    expect(validateSearchParams({ q: 'phish', type: 'observable', page: 3 })).toEqual({
      q: 'phish',
      type: 'observable',
      page: 3,
    })
  })

  test('defaults an absent query', () => {
    expect(validateSearchParams({})).toEqual({ q: '', type: 'case', page: 1 })
  })

  test('falls back to the case tab for an unknown type', () => {
    expect(validateSearchParams({ type: 'wombat' }).type).toBe('case')
  })

  // The API rejects offset < 0 and a non-integer/non-finite offset with 422.
  // Every malformed page must therefore collapse to 1.
  test.each([
    ['non-numeric', 'abc'],
    ['overflow to Infinity', '1e400'],
    ['negative', '-3'],
    ['zero', '0'],
    ['fractional', '1.5'],
    ['empty string', ''],
    ['undefined', undefined],
    ['null', null],
  ])('coerces a %s page to 1', (_label, page) => {
    expect(validateSearchParams({ page }).page).toBe(1)
  })

  test('every coerced page yields a finite, non-negative offset', () => {
    for (const page of ['abc', '1e400', '-3', '0', '1.5', '', undefined, null, 7]) {
      const offset = offsetFor(validateSearchParams({ page }).page)
      expect(Number.isInteger(offset)).toBe(true)
      expect(offset).toBeGreaterThanOrEqual(0)
    }
  })
})
