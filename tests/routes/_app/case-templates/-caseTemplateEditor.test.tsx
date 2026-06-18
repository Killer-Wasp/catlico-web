// @vitest-environment jsdom
import { CaseTemplateEditorPage } from '#/components/pages/CaseTemplateEditorPage'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
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
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

function Harness({ templateId = 'generic' }: { templateId?: string }) {
  return (
    <MantineProvider>
      <Notifications />
      <CaseTemplateEditorPage templateId={templateId} />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('CaseTemplateEditorPage', () => {
  test('renders the generic template item editor from the design doc', () => {
    render(<Harness />)

    expect(screen.getByRole('heading', { name: 'Edit template' })).toBeDefined()
    expect(
      screen.getByText('built-in template · changes save as an org override'),
    ).toBeDefined()
    expect(screen.getByDisplayValue('Generic investigation')).toBeDefined()
    expect(screen.getByDisplayValue('generic')).toBeDefined()
    expect(
      screen.getByDisplayValue(
        "Open-ended investigation skeleton for incidents that don't fit a more specific playbook.",
      ),
    ).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Defaults' })).toBeDefined()
    expect(screen.getByRole('radio', { name: 'MEDIUM' }).checked).toBe(true)
    expect(
      screen
        .getAllByRole('radio', { name: 'AMBER' })
        .filter((control) => control.checked),
    ).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeDefined()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Initial triage and scoping')).toBeDefined()
    expect(screen.getByDisplayValue('Close-out review')).toBeDefined()
    expect(screen.getByText(/No custom fields/i)).toBeDefined()
  })

  test('adds a task and confirms save', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '+ Add task' }))

    expect(screen.getByDisplayValue('New template task')).toBeDefined()

    fireEvent.click(screen.getAllByRole('button', { name: 'Save template' })[0])

    expect(await screen.findByText('Template saved')).toBeDefined()
  })
})
