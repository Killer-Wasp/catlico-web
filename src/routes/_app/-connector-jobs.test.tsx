// @vitest-environment jsdom
import { ConnectorJobsPage } from '#/components/Connectors/ConnectorJobsPage'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
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
      <ConnectorJobsPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('ConnectorJobsPage', () => {
  test('opens a right-side analysis report modal for a successful analyzer job', async () => {
    render(<Harness />)

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Report' }))[0],
    )

    const modal = await screen.findByRole('dialog', {
      name: /analysis job report/i,
    })

    expect(within(modal).getByText('Observable · ip')).toBeDefined()
    expect(within(modal).getAllByText('203.0.113.47')).toHaveLength(2)
    expect(within(modal).getByText('AbuseIPDB')).toBeDefined()
    expect(within(modal).getByText('abuse-score=97%')).toBeDefined()
    expect(within(modal).getByText('cdn-au-billing.net')).toBeDefined()
    expect(
      within(modal).getByText(
        '#1842 OAuth consent grant — privileged account compromise',
      ),
    ).toBeDefined()
    expect(
      within(modal).getByRole('button', { name: /toggle ioc/i }),
    ).toBeDefined()
    expect(
      within(modal).getByRole('button', { name: /export to misp/i }),
    ).toBeDefined()
  })
})
