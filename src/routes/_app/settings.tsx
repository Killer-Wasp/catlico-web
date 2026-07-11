import { SettingsLayout } from '#/components/pages/SettingsPage'
import { pluginsQueryOptions } from '#/components/Plugins/plugins'
import {
  customFieldsQueryOptions,
  organisationMembersQueryOptions,
  organisationProfileQueryOptions,
} from '#/components/pages/settings/settingsQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  // Warm each panel's data independently. `allSettled` (not `all`) so a role that
  // lacks one read permission — e.g. read:custom_field — degrades that panel to its
  // own error/empty state instead of failing the whole /settings route.
  loader: ({ context }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(organisationProfileQueryOptions()),
      context.queryClient.ensureQueryData(organisationMembersQueryOptions()),
      context.queryClient.ensureQueryData(customFieldsQueryOptions()),
      context.queryClient.ensureQueryData(pluginsQueryOptions()),
    ]),
  component: SettingsLayout,
})
