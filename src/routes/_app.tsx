import { AppShell } from '@mantine/core'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Navbar } from '#/components/Navbar/Navbar'
import { Header } from '#/components/Header/Header'
import { isAuthenticated } from '#/lib/auth/session'

// Pathless layout route. Everything nested under `_app` is rendered
// inside this shell. Routes that should be exempt (e.g. /login) live
// outside this folder and therefore skip the layout entirely.
//
// `ssr: false` renders the whole authed area on the client only. The auth
// state lives in localStorage, which doesn't exist during SSR — so running the
// guard (and the child loaders) on the client is what lets a hard refresh stay
// logged in instead of bouncing to /login. The guard below therefore always
// sees the real token.
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell navbar={{ width: 275, breakpoint: 'sm' }} padding={0}>
      <AppShell.Navbar>
        <Navbar />
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Header />
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
