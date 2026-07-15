import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { CaseStage } from '#/lib/domain'

/** A row of the org-scoped `case_status` lookup (app/models/case_status.py). */
export type CaseStatusPublic = {
  id: number
  organisation_id: string
  label: string
  stage: CaseStage
  color: string
  is_builtin: boolean
  hidden: boolean
  position: number
  created_at: string
  updated_at: string | null
}

export const CASE_STAGE_OPTIONS: { value: CaseStage; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
  { value: 'duplicated', label: 'Duplicated' },
]

export const caseStatusKeys = {
  all: ['case-statuses'] as const,
  list: () => [...caseStatusKeys.all, 'list'] as const,
}

async function fetchCaseStatuses(): Promise<CaseStatusPublic[]> {
  return api.get('case-statuses').json<CaseStatusPublic[]>()
}

export const caseStatusesQueryOptions = () =>
  queryOptions({
    queryKey: caseStatusKeys.list(),
    queryFn: fetchCaseStatuses,
  })

export async function createCaseStatus(body: {
  label: string
  stage: CaseStage
  color: string
}): Promise<CaseStatusPublic> {
  return api.post('case-statuses', { json: body }).json<CaseStatusPublic>()
}

export async function updateCaseStatus(
  id: number,
  body: Partial<{
    label: string
    stage: CaseStage
    color: string
    hidden: boolean
    position: number
  }>,
): Promise<CaseStatusPublic> {
  return api.patch(`case-statuses/${id}`, { json: body }).json<CaseStatusPublic>()
}

export async function deleteCaseStatus(id: number): Promise<void> {
  await api.delete(`case-statuses/${id}`)
}
