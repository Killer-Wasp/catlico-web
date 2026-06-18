// @vitest-environment jsdom
import type { Token, TokenField } from './TokenSearch'
import { TokenSearch } from './TokenSearch'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

// Mantine + Combobox need browser APIs jsdom doesn't implement.
beforeAll(() => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
  window.HTMLElement.prototype.scrollIntoView ??= () => {}
})

const FIELDS: TokenField[] = [
  {
    key: 'status',
    label: 'status',
    kind: 'enum',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'new', label: 'New' },
    ],
  },
  { key: 'title', label: 'title', kind: 'text' },
]

// Controlled wrapper so the component drives real token state through onChange.
function Harness() {
  const [tokens, setTokens] = useState<Token[]>([])
  return (
    <MantineProvider>
      <TokenSearch fields={FIELDS} tokens={tokens} onChange={setTokens} />
    </MantineProvider>
  )
}

const options = () => screen.queryAllByRole('option')
const optionByName = (name: string) =>
  options().find((o) => o.textContent === name)!

afterEach(cleanup)

describe('TokenSearch', () => {
  test('field stage lists every field on focus', () => {
    render(<Harness />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(options().map((o) => o.textContent)).toEqual(['status', 'title'])
  })

  test('selecting an enum field then a value commits a pill', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    fireEvent.click(optionByName('status'))
    // Value stage: the field's values are listed.
    expect(options().map((o) => o.textContent)).toEqual(['Open', 'New'])

    fireEvent.click(optionByName('Open'))
    // Pill committed, back to field stage.
    expect(screen.getByText('status:Open')).toBeDefined()
    expect(options().map((o) => o.textContent)).toEqual(['status', 'title'])
  })

  test('suppresses an already-selected enum value', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('status'))
    fireEvent.click(optionByName('Open'))

    // Re-enter status; "Open" should no longer be offered.
    fireEvent.click(optionByName('status'))
    expect(options().map((o) => o.textContent)).toEqual(['New'])
  })

  test('text field commits on Enter', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('title'))

    fireEvent.change(input, { target: { value: 'phish' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('title:phish')).toBeDefined()
  })

  test('backspace on empty input removes the last pill', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('status'))
    fireEvent.click(optionByName('Open'))

    expect(screen.queryByText('status:Open')).not.toBeNull()
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(screen.queryByText('status:Open')).toBeNull()
  })

  test('the ":" shortcut jumps from a typed field name into value stage', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'status' } })
    fireEvent.keyDown(input, { key: ':' })

    expect(options().map((o) => o.textContent)).toEqual(['Open', 'New'])
  })

  test('pill text reads field:label', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('status'))
    fireEvent.click(optionByName('Open'))

    expect(screen.getByText('status:Open')).toBeDefined()
  })
})
