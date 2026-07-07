import { OrganisationsPage } from '#/components/pages/OrganisationsPage'
import { currentUserQueryOptions } from '#/lib/auth/userQueries'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/organisations')({
  // Platform-admin only. `is_superadmin` isn't in the JWT, so read it from
  // `/users/me` (cached by React Query). Non-superadmins are bounced home.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    )
    if (!user.is_superadmin) {
      throw redirect({ to: '/' })
    }
  },
  component: OrganisationsPage,
})
