import { alertQueryOptions } from '#/components/Alerts/alertsQueries'
import { createFileRoute } from '@tanstack/react-router'

// `/alerts/$alertId` carries the open alert in the URL. The `AlertsPage`
// layout reads `alertId` from the route params and opens the drawer, so this
// child renders nothing itself. Warm the alert detail cache so hitting the URL
// directly (e.g. a shared link) shows the drawer without a fetch flash.
export const Route = createFileRoute('/_app/alerts/$alertId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(alertQueryOptions(params.alertId)),
  component: () => null,
})
