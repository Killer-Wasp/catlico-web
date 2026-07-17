/**
 * @vitest-environment jsdom
 *
 * Unit tests for the observable file affordances: the human-readable byte
 * formatter and the small paperclip indicator shown on list rows for
 * file-backed observables.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import {
  ObservableFileIndicator,
  formatBytes,
} from '#/components/pages/observables/ObservableFileIndicator'

afterEach(() => cleanup())

describe('formatBytes', () => {
  it('renders bytes, KB and MB thresholds', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2049)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('ObservableFileIndicator', () => {
  it('renders an accessible paperclip naming the file', () => {
    render(
      <MantineProvider>
        <ObservableFileIndicator
          attachment={{
            filename: 'evil.bin',
            size: 2049,
            content_type: 'application/octet-stream',
          }}
        />
      </MantineProvider>,
    )
    expect(screen.getByLabelText(/evil\.bin/)).toBeTruthy()
  })
})
