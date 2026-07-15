import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardsPage } from '#/components/pages/DashboardsPage'
import { dashboardsQueryOptions } from '#/components/Dashboards/dashboardsQueries'
import { overviewQueryOptions } from '#/components/Overview/overviewQueries'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'

export const Route = createFileRoute('/_app/dashboards')({
  // Dashboards is an enterprise-only capability; on the OSS build the flag is
  // false, so bounce to Overview. The API also 404s the dashboard endpoints.
  beforeLoad: async ({ context }) => {
    const caps = await context.queryClient.ensureQueryData(
      systemCapabilitiesQueryOptions(),
    )
    if (caps?.dashboard !== true) {
      throw redirect({ to: '/' })
    }
  },
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(dashboardsQueryOptions())
    void context.queryClient.ensureQueryData(overviewQueryOptions())
  },
  component: DashboardsPage,
})
