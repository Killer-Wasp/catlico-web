import { buildMatrix, TACTIC_ORDER } from '#/components/Attack/buildMatrix'
import type { PatternDto } from '#/components/Attack/attackQueries'
import { describe, expect, test } from 'vitest'

function pattern(overrides: Partial<PatternDto>): PatternDto {
  return {
    id: overrides.external_id ?? 'x',
    external_id: 'T0000',
    name: 'Technique',
    description: '',
    tactics: [],
    url: '',
    parent_external_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const CATALOG: PatternDto[] = [
  pattern({
    external_id: 'T1078',
    name: 'Valid Accounts',
    tactics: ['persistence', 'initial-access'],
  }),
  pattern({
    external_id: 'T1078.001',
    name: 'Default Accounts',
    tactics: ['persistence'],
    parent_external_id: 'T1078',
  }),
  pattern({
    external_id: 'T1566',
    name: 'Phishing',
    tactics: ['initial-access'],
  }),
  pattern({
    external_id: 'T1071',
    name: 'Application Layer Protocol',
    tactics: ['command-and-control'],
  }),
]

describe('buildMatrix', () => {
  test('columns come out in canonical kill-chain order, empty ones dropped', () => {
    const cols = buildMatrix(CATALOG, {})
    expect(cols.map((c) => c.tactic)).toEqual([
      'initial-access',
      'persistence',
      'command-and-control',
    ])
    expect(TACTIC_ORDER[0]).toBe('reconnaissance')
    expect(TACTIC_ORDER).toHaveLength(15)
  })

  test('a multi-tactic technique appears in every one of its columns', () => {
    const cols = buildMatrix(CATALOG, {})
    const ids = (tactic: string) =>
      cols
        .find((c) => c.tactic === tactic)!
        .techniques.map((t) => t.externalId)
    expect(ids('initial-access')).toEqual(['T1566', 'T1078'])
    expect(ids('persistence')).toEqual(['T1078'])
  })

  test('techniques are sorted by name within a column', () => {
    const cols = buildMatrix(CATALOG, {})
    const initialAccess = cols.find((c) => c.tactic === 'initial-access')!
    expect(initialAccess.techniques.map((t) => t.name)).toEqual([
      'Phishing',
      'Valid Accounts',
    ])
  })

  test('sub-techniques nest under their parent, not as top-level cells', () => {
    const cols = buildMatrix(CATALOG, {})
    const persistence = cols.find((c) => c.tactic === 'persistence')!
    const parent = persistence.techniques.find(
      (t) => t.externalId === 'T1078',
    )!
    expect(parent.subtechniques.map((s) => s.externalId)).toEqual(['T1078.001'])
    expect(
      persistence.techniques.some((t) => t.externalId === 'T1078.001'),
    ).toBe(false)
  })

  test('case counts land on the right cells, defaulting to 0', () => {
    const cols = buildMatrix(CATALOG, { T1566: 4, 'T1078.001': 1 })
    const initialAccess = cols.find((c) => c.tactic === 'initial-access')!
    const phishing = initialAccess.techniques.find(
      (t) => t.externalId === 'T1566',
    )!
    expect(phishing.caseCount).toBe(4)
    const valid = initialAccess.techniques.find(
      (t) => t.externalId === 'T1078',
    )!
    expect(valid.caseCount).toBe(0)
    const persistence = cols.find((c) => c.tactic === 'persistence')!
    expect(
      persistence.techniques[0].subtechniques[0].caseCount,
    ).toBe(1)
  })

  test('human-readable column labels', () => {
    const cols = buildMatrix(CATALOG, {})
    expect(cols.find((c) => c.tactic === 'initial-access')!.label).toBe(
      'Initial Access',
    )
  })

  test('honors MITRE canonical casing for command-and-control', () => {
    const cols = buildMatrix(CATALOG, {})
    expect(cols.find((c) => c.tactic === 'command-and-control')!.label).toBe(
      'Command and Control',
    )
  })

  test('empty catalog builds an empty matrix', () => {
    expect(buildMatrix([], {})).toEqual([])
  })

  test('techniques tagged with an unknown tactic surface in a trailing column, never dropped', () => {
    const cols = buildMatrix(
      [
        ...CATALOG,
        pattern({
          external_id: 'T9999',
          name: 'Entangle Qubits',
          tactics: ['quantum-hacking'],
        }),
      ],
      {},
    )

    const unknown = cols.find((c) => c.tactic === 'quantum-hacking')
    expect(unknown).toBeDefined()
    expect(unknown!.label).toBe('Quantum Hacking')
    expect(unknown!.techniques.map((t) => t.externalId)).toEqual(['T9999'])

    // The unknown column must come after every known TACTIC_ORDER column.
    const unknownIdx = cols.findIndex((c) => c.tactic === 'quantum-hacking')
    const lastKnownIdx = cols.reduce(
      (acc, c, i) =>
        (TACTIC_ORDER as readonly string[]).includes(c.tactic) ? i : acc,
      -1,
    )
    expect(unknownIdx).toBeGreaterThan(lastKnownIdx)
  })
})
