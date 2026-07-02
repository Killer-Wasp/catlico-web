import type { CaseSort } from '#/components/Cases/casesQueries'
import type { CaseStatus } from '#/lib/domain'

export const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'duplicated', label: 'Duplicated' },
]

// Table column id → the backend sort key it maps to. Only these columns are
// sortable server-side; the table's own filterFn/sortingFn are bypassed under
// the manual* flags below.
export const SORT_FIELD: Record<string, CaseSort> = {
  id: 'id',
  created: 'created',
  updated: 'updated',
}
