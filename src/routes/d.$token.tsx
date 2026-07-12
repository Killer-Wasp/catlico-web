import { createFileRoute } from '@tanstack/react-router'
import { PublicDashboardPage } from '#/components/pages/PublicDashboardPage'

// Standalone public route (not under `_app`, so no auth) — the target of a
// dashboard share link, `/d/:token`. Client-only.
export const Route = createFileRoute('/d/$token')({
  ssr: false,
  component: PublicDashboardRoute,
})

function PublicDashboardRoute() {
  const { token } = Route.useParams()
  return <PublicDashboardPage token={token} />
}
