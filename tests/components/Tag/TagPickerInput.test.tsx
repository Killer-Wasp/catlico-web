// @vitest-environment jsdom
import { TagPickerInput } from '#/components/Tag/TagPickerInput'
import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

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

function renderPicker({
  value = ['phishing', 'T1566'],
  onChange = vi.fn(),
}: {
  value?: string[]
  onChange?: (tags: string[]) => void
} = {}) {
  render(
    <MantineProvider>
      <TagPickerInput
        label="Tags"
        description="pick a suggested tag or type your own"
        placeholder="e.g. phishing, T1566"
        suggestions={['phishing', 'identity', 'T1566']}
        value={value}
        onChange={onChange}
      />
    </MantineProvider>,
  )
  return { onChange }
}

describe('TagPickerInput', () => {
  test('renders removable tag chips', () => {
    renderPicker()

    const removeButton = screen.getByRole('button', { name: 'Remove T1566' })
    const mitreChip = removeButton.closest('[data-tag-tone]')

    expect(mitreChip).not.toBeNull()
    expect(within(mitreChip as HTMLElement).getByText('T1566')).toBeDefined()
  })

  test('adds typed tags on blur', () => {
    const { onChange } = renderPicker()

    const input = screen.getByRole('textbox', { name: 'Tags' })
    fireEvent.change(input, { target: { value: 'credential-theft' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith([
      'phishing',
      'T1566',
      'credential-theft',
    ])
  })

  test('removes the final tag with backspace from an empty input', () => {
    const { onChange } = renderPicker()

    const input = screen.getByRole('textbox', { name: 'Tags' })
    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(onChange).toHaveBeenCalledWith(['phishing'])
  })
})
