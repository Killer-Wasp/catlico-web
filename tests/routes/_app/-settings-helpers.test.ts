import { describe, expect, test } from 'vitest'
import { csvField } from '#/components/pages/settings/panels/AuditLogPanel'
import {
  parseDuration,
  secondsToCompact,
} from '#/components/pages/settings/panels/SlaPanel'

describe('SLA duration conversion', () => {
  test('secondsToCompact renders compound durations losslessly', () => {
    expect(secondsToCompact(1800)).toBe('30m')
    expect(secondsToCompact(3600)).toBe('1h')
    expect(secondsToCompact(5400)).toBe('1h30m')
    expect(secondsToCompact(90000)).toBe('1d1h')
  })

  // The corruption bug: a value that isn't a clean multiple of one unit used to
  // round on display and get written back changed. Round-tripping must be exact
  // so saving never mutates a policy the user did not touch.
  test('parseDuration round-trips secondsToCompact exactly', () => {
    for (const seconds of [60, 1800, 5400, 7260, 86400, 90000, 172800]) {
      expect(parseDuration(secondsToCompact(seconds))).toBe(seconds)
    }
  })

  test('parseDuration accepts spacing and unit order', () => {
    expect(parseDuration('1h 30m')).toBe(5400)
    expect(parseDuration('2d4h')).toBe(187200)
  })

  test('parseDuration rejects empty, zero, and unparseable input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('0m')).toBeNull()
    expect(parseDuration('45')).toBeNull()
    expect(parseDuration('1.5h')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1h5')).toBeNull()
  })
})

describe('audit CSV escaping', () => {
  test('quotes fields and escapes embedded quotes', () => {
    expect(csvField('plain')).toBe('"plain"')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField(null)).toBe('""')
  })

  test('neutralises spreadsheet formula-injection prefixes', () => {
    expect(csvField('=1+1')).toBe(`"'=1+1"`)
    expect(csvField('+cmd')).toBe(`"'+cmd"`)
    expect(csvField('-2')).toBe(`"'-2"`)
    expect(csvField('@x')).toBe(`"'@x"`)
  })
})
