import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { SlaChip } from '#/components/Cases/SlaChip'

function renderChip(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

afterEach(cleanup)

describe('SlaChip', () => {
  test('renders nothing when there is no SLA state', () => {
    renderChip(<SlaChip state={null} dueAt="2026-06-12T18:00:00Z" />)
    expect(screen.queryByText(/SLA/i)).toBeNull()
  })

  test('renders nothing when there is no due time', () => {
    renderChip(<SlaChip state="ok" dueAt={null} />)
    expect(screen.queryByText(/SLA/i)).toBeNull()
  })

  test('labels the state for a breached case', () => {
    renderChip(<SlaChip state="breached" dueAt="2020-01-01T00:00:00Z" />)
    expect(screen.getByText(/SLA breached/i)).toBeDefined()
  })

  test('labels the state for an at-risk case', () => {
    renderChip(<SlaChip state="at-risk" dueAt="2999-01-01T00:00:00Z" />)
    expect(screen.getByText(/SLA at risk/i)).toBeDefined()
  })
})
