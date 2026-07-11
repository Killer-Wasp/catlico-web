// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { LoginPage } from '#/components/pages/LoginPage'

// The page renders router <Link>s, so it mounts inside a minimal memory router.
function Harness() {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider>
        <LoginPage />
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return <RouterProvider router={router} />
}

afterEach(cleanup)

describe('LoginPage', () => {
  test('renders the catlico branded sign in form without system copy', async () => {
    render(<Harness />)

    expect(await screen.findByRole('img', { name: 'Catlico logo' })).toBeDefined()
    expect(screen.getByText('Catlico')).toBeDefined()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByLabelText('Password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined()
    const forgot = screen.getByRole('link', { name: 'Forgot password?' })
    expect(forgot.getAttribute('href')).toBe('/forgot-password')
    expect(screen.queryByText(/THEHIVE CONSOLE/i)).toBeNull()
    expect(screen.queryByText(/Use of this system is monitored/i)).toBeNull()
    expect(screen.queryByText(/v5\.4\.2/i)).toBeNull()
  })
})
