// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ForgotPasswordPage } from '#/components/pages/ForgotPasswordPage'
import { requestPasswordReset } from '#/lib/auth/session'

vi.mock('#/lib/auth/session', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// The page renders router <Link>s, so it mounts inside a minimal memory router.
function renderPage() {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider>
        <ForgotPasswordPage />
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('ForgotPasswordPage', () => {
  test('renders the request form with a back-to-sign-in link', async () => {
    renderPage()
    expect(await screen.findByLabelText('Email')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDefined()
    const back = screen.getByRole('link', { name: 'Back to sign in' })
    expect(back.getAttribute('href')).toBe('/login')
  })

  test('submits the email and shows a generic confirmation', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Check your email')).toBeDefined()
    expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com')
  })
})
