import { AdminLayout } from '#/components/pages/SettingsPage'
import { myPermissionsQueryOptions } from '#/lib/auth/userQueries'
import { createFileRoute, redirect } from '@tanstack/react-router'

// The Admin page is privileged: only superadmins or holders of `manage:users`
// may reach it. Non-admins are bounced to Settings. The nav entry is gated the
// same way (Navbar), and every underlying API route enforces this server-side.
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const perms = await context.queryClient.ensureQueryData(
      myPermissionsQueryOptions(),
    )
    const allowed =
      perms.is_superadmin || perms.permissions.includes('manage:users')
    if (!allowed) {
      throw redirect({
        to: '/settings/$section',
        params: { section: 'organisation' },
      })
    }
  },
  component: AdminLayout,
})
