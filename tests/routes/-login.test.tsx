// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { LoginPage } from '#/components/pages/LoginPage'

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

function Harness() {
  return (
    <MantineProvider>
      <LoginPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('LoginPage', () => {
  test('renders the catlico branded sign in form without system copy', () => {
    render(<Harness />)

    expect(screen.getByRole('img', { name: 'Catlico logo' })).toBeDefined()
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
