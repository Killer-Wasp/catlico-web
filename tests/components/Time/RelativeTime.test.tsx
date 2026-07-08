// @vitest-environment jsdom
import {
  localDateTimeLabel,
  relativeTimeLabel,
} from '#/components/Time/RelativeTime'
import { describe, expect, test, vi } from 'vitest'

describe('RelativeTime helpers', () => {
  test('formats visible text with dayjs relative time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T07:00:00Z'))

    expect(relativeTimeLabel('2026-06-21T06:00:00Z')).toBe('an hour ago')
    expect(relativeTimeLabel('2026-06-22T07:00:00Z')).toBe('in a day')

    vi.useRealTimers()
  })

  test('formats tooltip text in local time', () => {
    expect(localDateTimeLabel('2026-06-21T06:00:00Z')).toMatch(
      /21 Jun 2026/,
    )
  })
})
