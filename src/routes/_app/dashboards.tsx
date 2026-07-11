import { createFileRoute } from '@tanstack/react-router'
import { DashboardsPage } from '#/components/pages/DashboardsPage'
import { dashboardsQueryOptions } from '#/components/Dashboards/dashboardsQueries'
import { overviewQueryOptions } from '#/components/Overview/overviewQueries'

export const Route = createFileRoute('/_app/dashboards')({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(dashboardsQueryOptions())
    void context.queryClient.ensureQueryData(overviewQueryOptions())
  },
  component: DashboardsPage,
})
