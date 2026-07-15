/**
 * Multi-assignee (primary + collaborators) shared types, DTO mapping, and the
 * replace-set mutations for cases + tasks. The primary owner is set via the
 * entity's PATCH `assignee_id`; these `PUT …/assignees` calls replace only the
 * collaborator set. Mirrors the backend `AssigneeRef` / `AssigneeSetRequest`
 * (app/models/common.py).
 */
import { api } from '#/lib/api/client'

/** Backend `AssigneeRef` shape (primary flagged). */
export type AssigneeRefDTO = {
  id: string
  email: string | null
  is_primary: boolean
}

/** UI assignee: `email` normalised to a string (empty when unknown). */
export type AssigneeRef = {
  id: string
  email: string
  isPrimary: boolean
}

/** Map the backend assignee list to the UI shape, primary first. */
export function toAssigneeRefs(
  dtos: AssigneeRefDTO[] | undefined,
): AssigneeRef[] {
  return (dtos ?? [])
    .map((d) => ({ id: d.id, email: d.email ?? '', isPrimary: d.is_primary }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
}

/** The collaborator (non-primary) user ids from a resolved assignee list. */
export function collaboratorIds(assignees: AssigneeRef[]): string[] {
  return assignees.filter((a) => !a.isPrimary).map((a) => a.id)
}

/** Replace a case's collaborator set (the primary is set separately via PATCH). */
export async function setCaseAssignees(
  caseId: string,
  userIds: string[],
): Promise<void> {
  const numeric = caseId.replace(/^#/, '')
  await api.put(`cases/${numeric}/assignees`, { json: { user_ids: userIds } })
}

/** Replace a task's collaborator set. */
export async function setTaskAssignees(
  caseId: number,
  taskId: number,
  userIds: string[],
): Promise<void> {
  await api.put(`cases/${caseId}/tasks/${taskId}/assignees`, {
    json: { user_ids: userIds },
  })
}
