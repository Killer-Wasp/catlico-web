import { AlertsPage } from '#/components/pages/AlertsPage'
import { createFileRoute } from '@tanstack/react-router'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'

export const Route = createFileRoute('/_app/alerts')({
  // Prefetch into the shared QueryClient cache before the component renders.
  // The page reads the same `queryOptions` via useSuspenseQuery, so it hits a
  // warm cache instead of refetching.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(alertsQueryOptions()),
  component: AlertsPage,
})
