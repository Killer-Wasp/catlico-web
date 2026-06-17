import { AppShell } from '@mantine/core'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Navbar } from '#/components/Navbar/Navbar'
import { Header } from '#/components/Header/Header'

// Pathless layout route. Everything nested under `_app` is rendered
// inside this shell. Routes that should be exempt (e.g. /login) live
// outside this folder and therefore skip the layout entirely.
export const Route = createFileRoute('/_app')({ component: AppLayout })

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
