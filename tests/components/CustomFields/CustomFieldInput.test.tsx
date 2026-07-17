/**
 * @vitest-environment jsdom
 *
 * Component tests for the type-aware custom-field pair: `CustomFieldInput`
 * (editor) and `CustomFieldValueDisplay` (read-only). Covers the new `url` type
 * validation, the options→dropdown path, and the display's linkify/boolean/date
 * formatting.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { CustomFieldInput, isValidUrl } from '#/components/CustomFields/CustomFieldInput'
import { CustomFieldValueDisplay } from '#/components/CustomFields/CustomFieldValueDisplay'

function wrap(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

afterEach(cleanup)

describe('isValidUrl', () => {
  it('accepts http/https and empty, rejects other schemes and garbage', () => {
    expect(isValidUrl('')).toBe(true)
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('http://a.b/c?d=1')).toBe(true)
    expect(isValidUrl('ftp://example.com')).toBe(false)
    expect(isValidUrl('not-a-url')).toBe(false)
  })
})

describe('CustomFieldInput', () => {
  it('renders a text input for a url field and validates the scheme', () => {
    const onChange = vi.fn()
    const { rerender } = wrap(
      <CustomFieldInput
        type="url"
        label="Ref"
        value="ftp://bad"
        onChange={onChange}
      />,
    )
    expect(screen.getByText('Enter an http/https URL')).toBeDefined()

    rerender(
      <MantineProvider>
        <CustomFieldInput
          type="url"
          label="Ref"
          value="https://ok.test"
          onChange={onChange}
        />
      </MantineProvider>,
    )
    expect(screen.queryByText('Enter an http/https URL')).toBeNull()
  })

  it('renders a number input for integer/float fields', () => {
    const onChange = vi.fn()
    wrap(
      <CustomFieldInput
        type="integer"
        label="Impact"
        value="5"
        onChange={onChange}
      />,
    )
    const input = screen.getByDisplayValue('5')
    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith('7')
  })

  it('renders a dropdown when options are provided', () => {
    wrap(
      <CustomFieldInput
        type="string"
        label="Unit"
        options={['finance', 'it']}
        value=""
        onChange={vi.fn()}
      />,
    )
    // Mantine Select renders as a combobox/textbox with the placeholder.
    expect(screen.getByPlaceholderText('—')).toBeDefined()
  })

  it('shows a Required error when flagged', () => {
    wrap(
      <CustomFieldInput
        type="string"
        label="Name"
        value=""
        error
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Required')).toBeDefined()
  })
})

describe('CustomFieldValueDisplay', () => {
  it('linkifies a url value', () => {
    wrap(<CustomFieldValueDisplay type="url" value="https://example.com/x" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://example.com/x')
  })

  it('renders a check for a truthy boolean', () => {
    wrap(<CustomFieldValueDisplay type="boolean" value={true} />)
    expect(screen.getByLabelText('yes')).toBeDefined()
  })

  it('renders a dash for an empty value', () => {
    wrap(<CustomFieldValueDisplay type="string" value={null} />)
    expect(screen.getByText('—')).toBeDefined()
  })

  it('formats a date value', () => {
    wrap(<CustomFieldValueDisplay type="date" value="2026-06-14T00:00:00Z" />)
    // Locale-formatted, so just assert the year is present.
    expect(screen.getByText(/2026/)).toBeDefined()
  })
})
