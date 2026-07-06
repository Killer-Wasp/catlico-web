import { queryOptions } from '@tanstack/react-query'
import { displayName } from '#/components/Cases/caseUsers'
import { api } from '#/lib/api/client'

/** Mirrors the backend `UserPublic` (app/models/user.py). */
export type UserPublic = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  is_active: boolean
  is_superadmin: boolean
  has_avatar: boolean
  created_at: string
  last_login_at: string | null
}

/** Full name when the user has one, otherwise a name derived from the email. */
export function userDisplayName(
  user: Pick<UserPublic, 'first_name' | 'last_name' | 'email'>,
): string {
  const full = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return full || displayName(user.email)
}

export const userKeys = {
  all: ['users'] as const,
  search: (q: string) => [...userKeys.all, 'search', q] as const,
}

/** Search org users by name/email — backs the assignee picker. */
export async function searchUsers(q: string, limit = 20): Promise<UserPublic[]> {
  return api
    .get('users/search', { searchParams: { q, limit: String(limit) } })
    .json<UserPublic[]>()
}

export const userSearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: userKeys.search(q),
    queryFn: () => searchUsers(q),
    // Keep the current results on screen while the next query resolves so the
    // list doesn't flash empty on every keystroke.
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })
