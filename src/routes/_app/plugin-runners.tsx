import { createFileRoute } from '@tanstack/react-router'
import { pluginRunnersQueryOptions } from '#/components/Plugins/pluginRunners'
import { RunnersPage } from '#/components/pages/plugins/runners/RunnersPage'

export const Route = createFileRoute('/_app/plugin-runners')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(pluginRunnersQueryOptions()),
  component: RunnersPage,
})
