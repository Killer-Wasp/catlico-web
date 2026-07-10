import { createFileRoute } from '@tanstack/react-router'
import { pluginsQueryOptions } from '#/components/Plugins/plugins'
import { PluginsPage } from '#/components/pages/plugins/PluginsPage'

export const Route = createFileRoute('/_app/plugins')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(pluginsQueryOptions()),
  component: PluginsPage,
})
