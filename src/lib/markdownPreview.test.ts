import { describe, expect, it } from 'vitest'
import { markdownPreview } from './markdownPreview'

describe('markdownPreview', () => {
  it('strips bold, italic and inline code from the first line', () => {
    expect(markdownPreview('**Objective:** remove *bad* `rules`')).toBe(
      'Objective: remove bad rules',
    )
  })

  it('uses the first non-empty line', () => {
    expect(markdownPreview('\n\n## Heading\n\nbody')).toBe('Heading')
  })

  it('strips list, task-list and blockquote markers', () => {
    expect(markdownPreview('- [ ] do the thing')).toBe('do the thing')
    expect(markdownPreview('> a note')).toBe('a note')
    expect(markdownPreview('1. first step')).toBe('first step')
  })

  it('reduces links to their text', () => {
    expect(markdownPreview('see [the runbook](/kb) now')).toBe(
      'see the runbook now',
    )
  })

  it('returns empty string for nullish or blank input', () => {
    expect(markdownPreview('')).toBe('')
    expect(markdownPreview(null)).toBe('')
    expect(markdownPreview(undefined)).toBe('')
  })
})
