import type { CaseSort } from '#/components/Cases/casesQueries'

// Table column id → the backend sort key it maps to. Only these columns are
// sortable server-side; the table's own filterFn/sortingFn are bypassed under
// the manual* flags below.
export const SORT_FIELD: Record<string, CaseSort> = {
  id: 'id',
  created: 'created',
  updated: 'updated',
}
