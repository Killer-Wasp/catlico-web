// @vitest-environment jsdom
import { CaseTemplatesPage } from './case-templates'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  pathname: '/case-templates',
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <div>Template editor outlet</div>,
  useLocation: () => ({ pathname: routerState.pathname }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children?: React.ReactNode
  }) => {
    const href = params
      ? to.replace('$templateId', params.templateId)
      : to
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
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

function Harness() {
  return (
    <MantineProvider>
      <Notifications />
      <CaseTemplatesPage />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('CaseTemplatesPage', () => {
  afterEach(() => {
    routerState.pathname = '/case-templates'
  })

  test('links template cards to the template item editor route', () => {
    render(<Harness />)

    expect(
      screen
        .getByRole('link', { name: 'Generic investigation' })
        .getAttribute('href'),
    ).toBe('/case-templates/generic')
    expect(
      screen
        .getAllByRole('link', { name: 'Edit' })
        .some((link) => link.getAttribute('href') === '/case-templates/generic'),
    ).toBe(true)
  })

  test('renders the child editor outlet on template item routes', () => {
    routerState.pathname = '/case-templates/generic'

    render(<Harness />)

    expect(screen.getByText('Template editor outlet')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Case templates' })).toBeNull()
  })
})
