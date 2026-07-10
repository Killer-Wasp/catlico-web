import { SettingsLayout } from '#/components/pages/SettingsPage'
import { pluginsQueryOptions } from '#/components/Plugins/plugins'
import {
  customFieldsQueryOptions,
  organisationMembersQueryOptions,
  organisationProfileQueryOptions,
} from '#/components/pages/settings/settingsQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(organisationProfileQueryOptions()),
      context.queryClient.ensureQueryData(organisationMembersQueryOptions()),
      context.queryClient.ensureQueryData(customFieldsQueryOptions()),
      context.queryClient.ensureQueryData(pluginsQueryOptions()),
    ]),
  component: SettingsLayout,
})
