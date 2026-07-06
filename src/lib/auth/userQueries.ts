import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

/**
 * Mirrors the backend `UserPublic` (app/models/user.py). Structurally identical
 * to `UserPublic` in usersQueries, so a `CurrentUser` can be handed to anything
 * that renders a user (e.g. `<UserAvatar>`).
 */
export type CurrentUser = {
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

export const currentUserKeys = {
  me: ['current-user'] as const,
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return api.get('users/me').json<CurrentUser>()
}

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: currentUserKeys.me,
    queryFn: fetchCurrentUser,
  })

/**
 * Fields of your own profile you can change. Names are editable freely; the
 * backend only requires `current_password` when `email` or `new_password` is
 * present (see PATCH /users/me).
 */
export type ProfileUpdate = {
  first_name?: string | null
  last_name?: string | null
  email?: string
  current_password?: string
  new_password?: string
}

/** PATCH /users/me — update your own details / credentials. */
export async function updateProfile(body: ProfileUpdate): Promise<CurrentUser> {
  return api.patch('users/me', { json: body }).json<CurrentUser>()
}

/** PUT /users/me/avatar — upload a new profile picture (must be an image). */
export async function uploadAvatar(file: File): Promise<CurrentUser> {
  const form = new FormData()
  form.append('file', file)
  return api.put('users/me/avatar', { body: form }).json<CurrentUser>()
}

/** DELETE /users/me/avatar — remove the current profile picture. */
export async function removeAvatar(): Promise<CurrentUser> {
  return api.delete('users/me/avatar').json<CurrentUser>()
}

/**
 * Two-letter avatar initials from an email local-part. `admin@example.com` →
 * "AD"; `j.tanaka@origin.example` → "JT". Falls back to "?" for an empty local.
 */
export function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[.\-_+]/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
