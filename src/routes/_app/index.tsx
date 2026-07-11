import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '#/components/pages/OverviewPage'
import { overviewQueryOptions } from '#/components/Overview/overviewQueries'

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(overviewQueryOptions()),
  component: OverviewPage,
})
