// @vitest-environment jsdom
import { Header } from '#/components/Header/Header'
import { MantineProvider } from '@mantine/core'
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
      <Header />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('Header notifications', () => {
  test('opens the notification popover and marks all notifications read', async () => {
    render(<Harness />)

    expect(screen.getByText('3')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    const panel = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(within(panel).getByText('Notifications')).toBeDefined()
    expect(within(panel).getByText('SLA breach imminent')).toBeDefined()
    expect(
      within(panel).getByText('SLA breach imminent').closest('button')
        ?.className,
    ).toContain('notificationItem')
    expect(within(panel).getByText(/Case #1842 acknowledges/)).toBeDefined()
    expect(within(panel).getByText('Critical alert ingested')).toBeDefined()
    expect(within(panel).getByText('Cortex job finished')).toBeDefined()
    expect(within(panel).getByText(/Settings → Notifications/)).toBeDefined()

    fireEvent.click(within(panel).getByText('Mark all read'))

    expect(screen.queryByText('3')).toBeNull()
  })
})
