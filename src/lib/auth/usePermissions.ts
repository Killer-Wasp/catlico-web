import { useQuery } from '@tanstack/react-query'
import { myPermissionsQueryOptions } from '#/lib/auth/userQueries'

/**
 * Client-side permission gating. `can` checks fine-grained capability strings
 * (e.g. `write:organisation`, `write:custom_field`) — the same the backend
 * enforces. Superadmins pass everything. This only hides UI; the API is the
 * real boundary.
 */
export function usePermissions() {
  const { data, isLoading } = useQuery(myPermissionsQueryOptions())
  const granted = new Set(data?.permissions ?? [])
  const isSuperadmin = data?.is_superadmin ?? false

  const can = (perm: string | string[]): boolean => {
    if (isSuperadmin) return true
    return Array.isArray(perm)
      ? perm.some((p) => granted.has(p))
      : granted.has(perm)
  }

  return {
    can,
    isSuperadmin,
    // Grantable groups the caller holds (for scope/role pickers).
    groups: data?.groups ?? [],
    isLoaded: data !== undefined,
    isLoading,
  }
}
