// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { ForgotPasswordPage } from '#/components/pages/ForgotPasswordPage'
import { requestPasswordReset } from '#/lib/auth/session'

vi.mock('#/lib/auth/session', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
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

function renderPage() {
  return render(
    <MantineProvider>
      <ForgotPasswordPage />
    </MantineProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  test('renders the request form with a back-to-sign-in link', () => {
    renderPage()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDefined()
    const back = screen.getByRole('link', { name: 'Back to sign in' })
    expect(back.getAttribute('href')).toBe('/login')
  })

  test('submits the email and shows a generic confirmation', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Check your email')).toBeDefined()
    expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com')
  })
})
