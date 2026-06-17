// @vitest-environment jsdom
import { SettingsPage } from '#/components/Settings/SettingsPage'
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
      <SettingsPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

function fieldValue(label: string) {
  const field = screen
    .getAllByLabelText(label)
    .find((element) => element instanceof HTMLInputElement)

  expect(field).toBeDefined()
  return (field as HTMLInputElement).value
}

describe('SettingsPage', () => {
  test('renders the organisation profile settings from the design doc', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined()
    expect(screen.getByRole('navigation', { name: /settings sections/i }))
      .toBeDefined()
    expect(screen.getByRole('button', { name: 'Organisation' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Users & roles' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Organisation profile' }))
      .toBeDefined()
    expect(fieldValue('Organisation name')).toBe('Catlico Security Operations')
    expect(fieldValue('Org short name')).toBe('origin-soc')
    expect(fieldValue('Timezone')).toBe('Australia/Sydney (AEST)')
    expect(fieldValue('Default case TLP')).toBe('TLP:AMBER')
  })

  test('confirms when organisation profile changes are saved', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Organisation profile saved')).toBeDefined()
  })

  test('renders every documented settings section', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Organisations' }))
    expect(screen.getByRole('heading', { name: 'Organisations' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Organisation links' }))
      .toBeDefined()
    expect(screen.getAllByText('Generation / OT SOC').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Users & roles' }))
    expect(screen.getByRole('heading', { name: 'Members' })).toBeDefined()
    expect(screen.getByText('J. Tanaka')).toBeDefined()

    fireEvent.click(
      screen.getByRole('button', { name: 'Profiles & permissions' }),
    )
    expect(screen.getByRole('heading', { name: 'Profiles' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'analyst' })).toBeDefined()
    expect(screen.getByText('Cases')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Custom fields' }))
    expect(screen.getByRole('heading', { name: 'Custom field definitions' }))
      .toBeDefined()
    expect(screen.getByText('Affected users')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Observable types' }))
    expect(screen.getByRole('heading', { name: 'Observable types' }))
      .toBeDefined()
    expect(screen.getByText('btc-address')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Taxonomies & tags' }))
    expect(screen.getByRole('heading', { name: 'Taxonomies' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Org freetags' })).toBeDefined()
    expect(screen.getByText('phishing')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByRole('heading', { name: 'Notification rules' }))
      .toBeDefined()
    expect(screen.getByRole('heading', { name: 'Notifiers' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Message template' }))
      .toBeDefined()
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview with sample event' }),
    )
    expect(await screen.findByText(/OAuth consent grant/i)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }))
    expect(screen.getByRole('heading', { name: 'MISP connectors' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Cortex servers' })).toBeDefined()
    expect(screen.getByText('MISP - Origin CTI')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'SLA policies' }))
    expect(screen.getByRole('heading', { name: 'SLA policies' })).toBeDefined()
    expect(screen.getByText('CRITICAL')).toBeDefined()
    expect(fieldValue('Critical time to acknowledge')).toBe('15m')

    fireEvent.click(screen.getByRole('button', { name: 'API keys' }))
    expect(screen.getByRole('heading', { name: 'API keys' })).toBeDefined()
    expect(screen.getByText('splunk-forwarder')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Integrations' }))
    expect(screen.getByRole('heading', { name: 'Connected integrations' }))
      .toBeDefined()
    expect(screen.getByText('Defender XDR')).toBeDefined()
    expect(screen.getByText('AUTH ERROR')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Audit log' }))
    expect(screen.getByRole('heading', { name: 'Audit log' })).toBeDefined()
    expect(screen.getByText('observable.create')).toBeDefined()
  })
})
