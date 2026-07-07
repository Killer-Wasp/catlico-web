// @vitest-environment jsdom
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

// Mantine + Combobox need browser APIs jsdom doesn't implement.
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

  test('committed filter pills render through the shared tag chip', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('status'))
    fireEvent.click(optionByName('Open'))

    expect(
      (screen
        .getByText('status:Open')
        .closest('[data-tag-tone]') as HTMLElement | null)?.dataset.tagTone,
    ).toBe('status')
  })

  test('committed filter tags include their own close button', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('status'))
    fireEvent.click(optionByName('Open'))

    const tag = screen.getByText('status:Open').closest('[data-tag-tone]')
    expect(tag).not.toBeNull()

    const removeButton = within(tag as HTMLElement).getByRole('button', {
      name: 'Remove status:Open filter',
    })
    fireEvent.click(removeButton)

    expect(screen.queryByText('status:Open')).toBeNull()
  })
})

// Fields that opt into operators (EC2-style): an operator stage between field
// and value, and `field = value` / `field : value` pills.
const OP_FIELDS: TokenField[] = [
  {
    key: 'status',
    label: 'Status',
    kind: 'enum',
    operators: ['eq'],
    options: [
      { value: 'open', label: 'Open' },
      { value: 'new', label: 'New' },
    ],
  },
  { key: 'title', label: 'Title', kind: 'text', operators: ['eq', 'co'] },
]

function OpHarness() {
  const [tokens, setTokens] = useState<Token[]>([])
  return (
    <MantineProvider>
      <TokenSearch fields={OP_FIELDS} tokens={tokens} onChange={setTokens} />
    </MantineProvider>
  )
}

describe('TokenSearch with operators', () => {
  test('single-operator enum field skips the operator stage', () => {
    render(<OpHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('Status'))

    // Straight to values — no operator stage for an Equals-only field.
    expect(options().map((o) => o.textContent)).toEqual(['Open', 'New'])
    fireEvent.click(optionByName('Open'))
    // Pill uses the EC2 "=" form, not "field:value".
    expect(screen.getByText('Status = Open')).toBeDefined()
  })

  test('multi-operator text field: pick Contains, then commit on Enter', () => {
    render(<OpHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('Title'))

    // Operator stage lists Equals and Contains.
    expect(options().map((o) => o.textContent)).toEqual([
      'Title = — Equals',
      'Title : — Contains',
    ])

    fireEvent.click(optionByName('Title : — Contains'))
    fireEvent.change(input, { target: { value: 'phish' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Title : phish')).toBeDefined()
  })

  test('in-progress operator filters render through the shared tag chip', () => {
    render(<OpHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('Title'))
    fireEvent.click(optionByName('Title = — Equals'))

    const tag = screen.getByText('Title =').closest('[data-tag-tone]')
    expect(tag).not.toBeNull()

    const clearButton = within(tag as HTMLElement).getByRole('button', {
      name: 'Clear Title = filter',
    })
    fireEvent.click(clearButton)

    expect(screen.queryByText('Title =')).toBeNull()
    expect(options().map((o) => o.textContent)).toEqual(['Status', 'Title'])
  })

  test('backspace steps back from value to operator stage', () => {
    render(<OpHarness />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.click(optionByName('Title'))
    fireEvent.click(optionByName('Title = — Equals'))

    // In value stage; empty-input backspace returns to the operator stage.
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(options().map((o) => o.textContent)).toEqual([
      'Title = — Equals',
      'Title : — Contains',
    ])
  })
})
