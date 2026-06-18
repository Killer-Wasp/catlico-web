import { LoginPage } from '#/components/pages/LoginPage'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '#/lib/auth/session'

// Standalone route — not nested under `_app`, so it renders without
// the app shell layout. Already-authenticated clients skip to the app.
// `ssr: false` so the guard reads the real localStorage token on the client
// (an already-logged-in user refreshing /login is sent on to the app).
export const Route = createFileRoute('/login')({
  ssr: false,
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})
