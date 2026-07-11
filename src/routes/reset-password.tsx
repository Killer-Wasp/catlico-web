import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '#/components/pages/ResetPasswordPage'

// Standalone route (not under `_app`) — the target of the emailed reset link,
// `/reset-password?token=…`. `ssr: false` because it's a client-only auth screen.
export const Route = createFileRoute('/reset-password')({
  ssr: false,
  validateSearch: (search) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: ResetPasswordRoute,
})

function ResetPasswordRoute() {
  const { token } = Route.useSearch()
  return <ResetPasswordPage token={token} />
}
