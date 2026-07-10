// @vitest-environment jsdom
import { Snippet } from '#/components/Search/Snippet'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
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
})

afterEach(cleanup)

const wrap = (ui: React.ReactNode) => render(<MantineProvider>{ui}</MantineProvider>)

describe('Snippet', () => {
  test('renders marked segments as <mark> and the rest as text', () => {
    wrap(<Snippet text="same <mark>phish</mark> kit as <mark>last</mark> month" />)
    const marks = document.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('phish')
    expect(screen.getByText(/kit as/)).toBeDefined()
  })

  test('never injects HTML from content', () => {
    wrap(<Snippet text={'<img src=x onerror=alert(1)> <mark>hit</mark>'} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText(/img src/)).toBeDefined()
  })
})
