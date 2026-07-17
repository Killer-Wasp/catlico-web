import { AppShell } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Navbar } from '#/components/Navbar/Navbar'
import { Header } from '#/components/Header/Header'
import { SearchPalette } from '#/components/Search/SearchPalette'
import { ensureSession } from '#/lib/auth/session'
import { sanitizeReturnUrl } from '#/lib/auth/redirects'

// Pathless layout route. Everything nested under `_app` is rendered
// inside this shell. Routes that should be exempt (e.g. /login) live
// outside this folder and therefore skip the layout entirely.
//
// `ssr: false` renders the whole authed area on the client only. The access
// token lives in JS memory, which doesn't exist during SSR — so running the
// guard (and the child loaders) on the client is what lets a hard refresh
// stay logged in: `ensureSession` turns the httpOnly refresh cookie into a
// fresh access token before anything renders.
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!(await ensureSession())) {
      throw redirect({
        to: '/login',
        search: { returnUrl: sanitizeReturnUrl(location.href) },
      })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  // Persist the collapsed preference so a refresh keeps the nav as the user
  // left it. `_app` is client-only (ssr: false), so localStorage is safe here.
  const [collapsed, setCollapsed] = useLocalStorage({
    key: 'catlico-navbar-collapsed',
    defaultValue: false,
  })

  return (
    <>
      <AppShell
        // `alt` layout: the navbar spans the full height on the left (so the
        // CATLICO logo sits at the very top), and the header is offset by the
        // navbar width — it persists at the top of the content area only,
        // rather than stretching across the whole viewport above the sidebar.
        layout="alt"
        header={{ height: 64 }}
        navbar={{ width: collapsed ? 80 : 275, breakpoint: 'sm' }}
        padding={0}
      >
        <AppShell.Navbar>
          <Navbar
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
        </AppShell.Navbar>

        {/* Header lives in AppShell's dedicated header slot so it stays fixed on
            scroll and the main content is offset automatically. */}
        <AppShell.Header>
          <Header />
        </AppShell.Header>

        <AppShell.Main
          style={{
            backgroundColor:
              'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
          }}
        >
          <Outlet />
        </AppShell.Main>
      </AppShell>
      <SearchPalette />
    </>
  )
}
