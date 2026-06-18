// @vitest-environment jsdom
import { FunctionsPage } from '#/components/pages/FunctionsPage'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
      <FunctionsPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('FunctionsPage', () => {
  test('renders the documented functions list', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Functions' })).toBeDefined()
    expect(
      screen.getByText(
        'automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile',
      ),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: '+ New function' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'All functions' })).toBeDefined()
    expect(screen.getByText('4 functions')).toBeDefined()
    expect(screen.getByText('click a function to edit')).toBeDefined()

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(5)
    expect(
      screen.getByRole('button', {
        name: /Edit Auto-enrich new IP observables/i,
      }),
    ).toBeDefined()
    expect(screen.getByText('event')).toBeDefined()
    expect(screen.getAllByText('analyst').length).toBeGreaterThan(0)
    expect(screen.getByText('3 err')).toBeDefined()
    expect(screen.getByText('Partner IOC webhook intake')).toBeDefined()
    expect(screen.getByText('1-4 of 4')).toBeDefined()
  })

  test('opens an editable function with code, trigger, execution and history panels', () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', {
        name: /Edit Auto-enrich new IP observables/i,
      }),
    )

    expect(screen.getByRole('heading', { name: 'Edit function' })).toBeDefined()
    expect(screen.getByText('412 runs · 3 errors')).toBeDefined()
    expect(screen.getByDisplayValue('Auto-enrich new IP observables')).toBeDefined()
    expect(screen.getAllByDisplayValue('javascript').length).toBeGreaterThan(0)
    expect(
      screen.getByDisplayValue('observable.dataType == "ip"'),
    ).toBeDefined()
    expect(screen.getByDisplayValue('15000')).toBeDefined()
    expect(
      screen.getByDisplayValue('api.abuseipdb.com, hooks.slack.com'),
    ).toBeDefined()
    expect(screen.getByText('ABUSEIPDB_KEY')).toBeDefined()
    expect(screen.getByText('SLACK_TOKEN')).toBeDefined()
    expect(screen.getByText('failure')).toBeDefined()
    expect(screen.getByText('timeout')).toBeDefined()
  })

  test('runs a test execution and prepends a console/history entry', async () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', {
        name: /Edit Auto-enrich new IP observables/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Test run/i }))

    expect(screen.getByText(/\[done\] handler resolved in 0\.94s/i)).toBeDefined()
    expect(await screen.findByText('Test run completed')).toBeDefined()
    const history = screen.getByRole('table', { name: 'Run history' })
    expect(within(history).getByText('just now')).toBeDefined()
  })
})
