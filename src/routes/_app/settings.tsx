import { SettingsLayout } from '#/components/pages/SettingsPage'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
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
      context.queryClient.ensureQueryData(connectorsQueryOptions()),
    ]),
  component: SettingsLayout,
})
