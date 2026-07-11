// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { ResetPasswordPage } from '#/components/pages/ResetPasswordPage'
import { resetPassword } from '#/lib/auth/session'

vi.mock('#/lib/auth/session', () => ({
  resetPassword: vi.fn().mockResolvedValue(undefined),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage(token?: string) {
  return render(
    <MantineProvider>
      <ResetPasswordPage token={token} />
    </MantineProvider>,
  )
}

describe('ResetPasswordPage', () => {
  test('shows an invalid-link state when the token is missing', () => {
    renderPage(undefined)
    expect(screen.getByText('Invalid reset link')).toBeDefined()
    const link = screen.getByRole('link', { name: 'Request a new link' })
    expect(link.getAttribute('href')).toBe('/forgot-password')
  })

  test('validates the minimum password length and blocks submit', () => {
    renderPage('tok-123')
    fireEvent.change(screen.getByLabelText('New password'), {
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
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-brand-new-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Password updated')).toBeDefined()
    expect(resetPassword).toHaveBeenCalledWith('tok-123', 'a-brand-new-password')
  })
})
