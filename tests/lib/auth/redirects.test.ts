// @vitest-environment jsdom
import {
  currentReturnUrl,
  loginHref,
  sanitizeReturnUrl,
} from '#/lib/auth/redirects'
import { beforeEach, describe, expect, test } from 'vitest'

describe('auth redirects', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/')
  })

  test('keeps safe same-origin return paths', () => {
    expect(sanitizeReturnUrl('/cases/2/details?tab=tasks#work')).toBe(
      '/cases/2/details?tab=tasks#work',
    )
    expect(
      sanitizeReturnUrl(
        new URL('/alerts?filter=sev~eq~4', window.location.origin).toString(),
      ),
    ).toBe('/alerts?filter=sev~eq~4')
  })

  test('rejects unsafe or looping return paths', () => {
    expect(sanitizeReturnUrl('https://example.com/cases')).toBe('/')
    expect(sanitizeReturnUrl('//example.com/cases')).toBe('/')
    expect(sanitizeReturnUrl('/login?returnUrl=/cases')).toBe('/')
    expect(sanitizeReturnUrl(null)).toBe('/')
  })

  test('builds a login href with the encoded return url', () => {
    expect(loginHref('/cases/2/details')).toBe(
      '/login?returnUrl=%2Fcases%2F2%2Fdetails',
    )
  })

  test('reads the current browser path as the default return url', () => {
    window.history.pushState(null, '', '/observables?filter=type~eq~domain')

    expect(currentReturnUrl()).toBe('/observables?filter=type~eq~domain')
    expect(loginHref()).toBe(
      '/login?returnUrl=%2Fobservables%3Ffilter%3Dtype%7Eeq%7Edomain',
    )
  })
})
