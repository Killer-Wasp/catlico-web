import {
  clausesToTokens,
  filterParamsToClauses,
  tokensToFilterParams,
  validateCaseSearch,
} from '#/components/Cases/caseFilterSearch'
import type { TokenField } from '#/components/Table/TokenSearch'
import { describe, expect, test } from 'vitest'

const fields: TokenField[] = [
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    options: [{ value: 'Open', label: 'Open' }],
  },
  {
    key: 'severity',
    label: 'Severity',
    kind: 'enum',
    options: [{ value: '4', label: 'Critical' }],
  },
]

describe('case filter search params', () => {
  test('normalizes a single filter param into an array search value', () => {
    expect(validateCaseSearch({ filter: 'status~eq~Open' })).toEqual({
      filter: ['status~eq~Open'],
    })
  })

  test('drops malformed clauses while preserving valid URL filters', () => {
    expect(
      filterParamsToClauses([
        'status~eq~Open',
        'title~co~phish',
        'bad',
        'severity~nope~4',
      ]),
    ).toEqual([
      { key: 'status', op: 'eq', value: 'Open' },
      { key: 'title', op: 'co', value: 'phish' },
    ])
  })

  test('round trips tokens through repeated filter params', () => {
    const tokens = clausesToTokens(
      [
        { key: 'status', op: 'eq', value: 'Open' },
        { key: 'severity', op: 'eq', value: '4' },
      ],
      fields,
    )

    expect(tokens).toEqual([
      { field: 'status', op: 'eq', value: 'Open', label: 'Open' },
      { field: 'severity', op: 'eq', value: '4', label: 'Critical' },
    ])
    expect(tokensToFilterParams(tokens)).toEqual([
      'status~eq~Open',
      'severity~eq~4',
    ])
  })
})
