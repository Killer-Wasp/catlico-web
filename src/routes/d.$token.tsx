import { createFileRoute, notFound } from '@tanstack/react-router'
import { PublicDashboardPage } from '#/components/pages/PublicDashboardPage'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'

// Standalone public route (not under `_app`, so no auth) — the target of a
// dashboard share link, `/d/:token`. Client-only.
export const Route = createFileRoute('/d/$token')({
  ssr: false,
  // Dashboards is enterprise-only: 404 the public share link when the build
  // reports the flag off. The capability probe needs auth, so if it can't be
  // read (an unauthenticated visitor) we fall through — the server still 404s
  // the public dashboard endpoint on the OSS build.
  beforeLoad: async ({ context }) => {
    let caps
    try {
      caps = await context.queryClient.ensureQueryData(
        systemCapabilitiesQueryOptions(),
      )
    } catch {
      caps = undefined
    }
    if (caps && caps.dashboard !== true) {
      throw notFound()
    }
  },
  component: PublicDashboardRoute,
})

function PublicDashboardRoute() {
  const { token } = Route.useParams()
  return <PublicDashboardPage token={token} />
}
