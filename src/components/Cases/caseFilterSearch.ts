import type { Token, TokenField } from '#/components/Table/TokenSearch'
import type { FilterClause } from '#/lib/filters'

export type CaseSearch = {
  filter?: string[]
}

/**
 * Default cases view: active work only (Open | In progress). Materialised into
 * the URL on a fresh visit; same-key values OR server-side. Users can remove the
 * pills or clear the filters to see every case.
 */
export const DEFAULT_CASE_FILTER_PARAMS: string[] = [
  'status~eq~Open',
  'status~eq~In progress',
]

function normalizeFilter(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]
  const filters = values.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  )
  return filters.length ? filters : undefined
}

export function validateCaseSearch(search: Record<string, unknown>): CaseSearch {
  return {
    filter: normalizeFilter(search.filter),
  }
}

export function filterParamToClause(raw: string): FilterClause | null {
  const [key, op, value] = raw.split('~', 3).map((part) => part.trim())
  if (!key || !value || (op !== 'eq' && op !== 'co')) return null
  return { key, op, value }
}

export function filterParamsToClauses(filters?: readonly string[]): FilterClause[] {
  return (filters ?? []).flatMap((raw) => {
    const clause = filterParamToClause(raw)
    return clause ? [clause] : []
  })
}

export function tokensToFilterParams(tokens: readonly Token[]): string[] | undefined {
  const params = tokens.map((token) => {
    const op = token.op ?? 'eq'
    return `${token.field}~${op}~${token.value}`
  })
  return params.length ? params : undefined
}

export function clausesToTokens(
  clauses: readonly FilterClause[],
  fields: readonly TokenField[],
): Token[] {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))
  return clauses.map((clause) => {
    const field = fieldByKey.get(clause.key)
    const option = field?.options?.find((item) => item.value === clause.value)
    return {
      field: clause.key,
      op: clause.op,
      value: clause.value,
      label: option?.label ?? clause.value,
    }
  })
}
