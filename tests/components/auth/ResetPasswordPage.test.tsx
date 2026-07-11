// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HTTPError } from 'ky'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ResetPasswordPage } from '#/components/pages/ResetPasswordPage'
import { resetPassword } from '#/lib/auth/session'

vi.mock('#/lib/auth/session', () => ({
  resetPassword: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// The page renders router <Link>s, so it mounts inside a minimal memory router.
function renderPage(token?: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <MantineProvider>
        <ResetPasswordPage token={token} />
      </MantineProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

function http400(detail: string): HTTPError {
  const response = new Response(JSON.stringify({ detail }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
  return new HTTPError(
    response,
    new Request('http://localhost/api/v1/auth/password/reset'),
    // options are unused by the code under test
    {} as ConstructorParameters<typeof HTTPError>[2],
  )
}

describe('ResetPasswordPage', () => {
  test('shows an invalid-link state when the token is missing', async () => {
    renderPage(undefined)
    expect(await screen.findByText('Invalid reset link')).toBeDefined()
    const link = screen.getByRole('link', { name: 'Request a new link' })
    expect(link.getAttribute('href')).toBe('/forgot-password')
  })

  test('validates the minimum password length and blocks submit', async () => {
    renderPage('tok-123')
    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'short' },
    })
    expect(screen.getByText('Use at least 12 characters')).toBeDefined()
    expect(
      screen
        .getByRole('button', { name: 'Reset password' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(resetPassword).not.toHaveBeenCalled()
  })

  test('resets the password on a valid matching entry', async () => {
    renderPage('tok-123')
    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Password updated')).toBeDefined()
    expect(resetPassword).toHaveBeenCalledWith('tok-123', 'a-brand-new-password')
  })

  test('surfaces the server 400 detail instead of a canned message', async () => {
    vi.mocked(resetPassword).mockRejectedValueOnce(
      http400('Password must be at least 12 characters'),
    )
    renderPage('tok-123')
    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(
      await screen.findByText('Password must be at least 12 characters'),
    ).toBeDefined()
  })
})
