import { LoginPage } from '#/components/Login/LoginPage'
import { createFileRoute } from '@tanstack/react-router'

// Standalone route — not nested under `_app`, so it renders without
// the app shell layout.
export const Route = createFileRoute('/login')({ component: LoginPage })
