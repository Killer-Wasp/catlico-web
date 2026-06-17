// @vitest-environment jsdom
import { ObservablesPage } from '#/components/Observables/ObservablesPage'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

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
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  })
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

function Harness() {
  return (
    <MantineProvider>
      <Notifications />
      <ObservablesPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('ObservablesPage', () => {
  test('renders an observable table with search-bar filters, bulk actions and pagination', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Observables' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Run analyzers on selected' }),
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: 'Export selected to MISP' }),
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: '+ Add observable' }),
    ).toBeDefined()
    expect(
      screen.getByRole('heading', { name: 'All observables' }),
    ).toBeDefined()
    expect(screen.getByText('8 observables · 6 IOC')).toBeDefined()
    expect(
      screen.getByPlaceholderText(
        'Filter observables — pick a field, then a value',
      ),
    ).toBeDefined()
    expect(screen.getByText('login-originenergy.support')).toBeDefined()
    expect(screen.getAllByText('TLP:AMBER').length).toBeGreaterThan(0)
    expect(screen.getByText('VT 12/93')).toBeDefined()
    expect(screen.getByText('1-6 of 8')).toBeDefined()
  })

  test('enables bulk actions when an observable is selected', () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select observable login-originenergy.support',
      }),
    )

    expect(
      screen.getByRole('button', { name: 'Run analyzers on selected' }),
    ).toHaveProperty('disabled', false)
    expect(
      screen.getByRole('button', { name: 'Export selected to MISP' }),
    ).toHaveProperty('disabled', false)
  })

  test('filters observables by token search field', () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByPlaceholderText(
        'Filter observables — pick a field, then a value',
      ),
    )
    fireEvent.click(screen.getByRole('option', { name: 'Type' }))
    fireEvent.click(screen.getByRole('option', { name: 'Ip' }))

    expect(screen.getByText('203.0.113.47')).toBeDefined()
    expect(screen.getByText('198.51.100.22')).toBeDefined()
    expect(screen.queryByText('login-originenergy.support')).toBeNull()
    expect(screen.getByText('1-2 of 2')).toBeDefined()
  })

  test('opens an observable detail modal when a row is clicked', () => {
    render(<Harness />)

    fireEvent.click(screen.getByText('203.0.113.47'))

    const modal = screen.getByRole('dialog', { name: /observable detail/i })

    expect(modal).toBeDefined()
    expect(screen.getByText('OBSERVABLE · ip')).toBeDefined()
    expect(screen.getAllByText('203.0.113.47').length).toBeGreaterThan(1)
    expect(screen.getAllByText('MALICIOUS').length).toBeGreaterThan(0)
    expect(screen.getByText(/properties/i)).toBeDefined()
    expect(screen.getByText('AbuseIPDB')).toBeDefined()
    expect(screen.getByText('GreyNoise')).toBeDefined()
    expect(screen.getByText('cdn-au-billing.net')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Toggle IOC' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Mark sighted' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Export to MISP' })).toBeDefined()
  })
})
