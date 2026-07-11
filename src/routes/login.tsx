import { LoginPage } from '#/components/pages/LoginPage'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureSession } from '#/lib/auth/session'
import { sanitizeReturnUrl } from '#/lib/auth/redirects'

// Standalone route — not nested under `_app`, so it renders without
// the app shell layout. Already-authenticated clients skip to the app.
// `ssr: false` so the guard runs on the client, where `ensureSession` can
// use the httpOnly refresh cookie (an already-logged-in user visiting
// /login is sent on to the app; anonymous users get a fast 401 and stay).
export const Route = createFileRoute('/login')({
  ssr: false,
  validateSearch: (search) => ({
    returnUrl: sanitizeReturnUrl(search.returnUrl),
  }),
  beforeLoad: async ({ search }) => {
    if (await ensureSession()) {
      throw redirect({ href: search.returnUrl })
    }
  },
  component: LoginRoute,
})

function LoginRoute() {
  const { returnUrl } = Route.useSearch()
  return <LoginPage returnUrl={returnUrl} />
}
