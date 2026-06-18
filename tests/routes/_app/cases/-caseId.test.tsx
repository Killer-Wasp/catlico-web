// @vitest-environment jsdom
import { getCaseDetail } from '#/components/Cases/caseDetails'
import { CaseTabPanel } from '#/components/pages/CaseDetailPage'
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
  return <CaseTabHarness tab="observables" />
}

function CaseTabHarness({ tab }: { tab: 'observables' | 'tasks' }) {
  return (
    <MantineProvider>
      <Notifications />
      <CaseTabPanel tab={tab} caseDetail={getCaseDetail('1842')} />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('case observables tab', () => {
  test('opens an observable detail drawer when an observable row is clicked', async () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByText('hxxps://cdn-au-billing[.]net/invoice.php'),
    )

    const drawer = await screen.findByRole('dialog', {
      name: /observable detail/i,
    })

    expect(within(drawer).getByText('OBSERVABLE · url')).toBeDefined()
    expect(
      within(drawer).getAllByText('hxxps://cdn-au-billing[.]net/invoice.php')
        .length,
    ).toBeGreaterThan(0)
    expect(
      within(drawer).getAllByText('MALICIOUS').length,
    ).toBeGreaterThan(0)
    expect(within(drawer).getByText('URLscan.io')).toBeDefined()
    expect(
      within(drawer).getAllByText('cdn-au-billing.net').length,
    ).toBeGreaterThan(0)
    expect(
      within(drawer).getByText(
        'OAuth consent grant — privileged account compromise',
      ),
    ).toBeDefined()
    expect(
      within(drawer).getByRole('button', { name: /export to misp/i }),
    ).toBeDefined()
  })
})

describe('case tasks tab', () => {
  test('opens a task detail drawer when a task row is clicked', async () => {
    render(<CaseTabHarness tab="tasks" />)

    fireEvent.click(
      screen.getByText('Disable malicious app registration tenant-wide'),
    )

    const drawer = await screen.findByRole('dialog', {
      name: /task detail/i,
    })

    expect(within(drawer).getByText('#1842 · task T-1843-4')).toBeDefined()
    expect(
      within(drawer).getAllByDisplayValue(
        'Disable malicious app registration tenant-wide',
      ).length,
    ).toBeGreaterThan(0)
    expect(within(drawer).getByRole('button', { name: /in progress/i })).toBeDefined()
    expect(within(drawer).getByDisplayValue('Contain')).toBeDefined()
    expect(
      within(drawer).getByDisplayValue(
        "Block the app registration (app id 7f3c…91ab) across the tenant and add to the org's blocked apps policy. Coordinate with the Identity team if any legitimate consent exists.",
      ),
    ).toBeDefined()
    expect(
      within(drawer).getByText(/App registration disabled in our tenant/),
    ).toBeDefined()
    expect(within(drawer).getByRole('button', { name: /save/i })).toBeDefined()
  })
})
