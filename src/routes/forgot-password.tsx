import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordPage } from '#/components/pages/ForgotPasswordPage'

// Standalone route (not under `_app`) — renders without the app shell, like
// /login. `ssr: false` because it's a client-only auth screen.
export const Route = createFileRoute('/forgot-password')({
  ssr: false,
  component: ForgotPasswordPage,
})
