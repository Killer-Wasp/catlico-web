// Shared types + serialization for the list views' clause-based filters.
// Each list endpoint takes repeated `filter=key~op~value` query params: terms
// are OR'd within a key and AND'd across keys.

/** Filter operator: exact match (`eq`) or case-insensitive substring (`co`). */
export type FilterOp = 'eq' | 'co'

/**
 * One `key op value` filter term. `key` is a core field or a tag key
 * (`tag:<group-key>`, e.g. `tag:tlp`).
 */
export type FilterClause = { key: string; op: FilterOp; value: string }

/** Append each clause as a repeated `filter=key~op~value` param. */
export function appendClauses(
  params: URLSearchParams,
  clauses: FilterClause[] | undefined,
) {
  for (const c of clauses ?? []) {
    params.append('filter', `${c.key}~${c.op}~${c.value}`)
  }
}
