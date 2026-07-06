import { organisationMembersQueryOptions } from '#/components/pages/settings/settingsQueries'
import { useQuery } from '@tanstack/react-query'

/**
 * Assignee identifiers (member emails) for the active organisation. Sourced from
 * the org-members API — empty while the query loads, and empty (never throwing)
 * when no org is active, so it is safe to call from any component.
 */
export function useAssignees(): string[] {
  const { data: members } = useQuery(organisationMembersQueryOptions())
  return (members ?? []).map((member) => member.email)
}

/**
 * `data` for a plain string Mantine `Select`: "Unassigned" plus each org member.
 * `current` keeps an already-assigned value in the list even if that person is
 * no longer returned by the members query.
 */
export function useAssigneeStringOptions(current?: string): string[] {
  const assignees = useAssignees()
  return [
    'Unassigned',
    ...new Set([
      ...assignees,
      ...(current && current !== 'Unassigned' ? [current] : []),
    ]),
  ]
}

/**
 * `data` for a `{ value, label }` Mantine `Select` where an empty value means
 * unassigned (the case-template editor's convention).
 */
export function useAssigneeSelectOptions(
  current?: string,
): { value: string; label: string }[] {
  const assignees = useAssignees()
  const values = [
    ...new Set([...assignees, ...(current ? [current] : [])]),
  ]
  return [
    { value: '', label: 'Unassigned' },
    ...values.map((value) => ({ value, label: value })),
  ]
}
