import { createFileRoute } from '@tanstack/react-router'

// Index child of the `/alerts` layout: renders nothing into the layout's
// Outlet. The alert drawer is closed when no `$alertId` is in the URL.
export const Route = createFileRoute('/_app/alerts/')({
  component: () => null,
})
