/**
 * Unit test for the org-wide MFA-policy data module (`/admin/mfa/settings`).
 *
 * The load-bearing guarantee here is that the PUT is a FULL REPLACE: every
 * `updateMfaSettings` call MUST carry BOTH `enabled` and `enforced`, or the
 * backend silently clobbers the field the UI didn't send. These tests pin that
 * contract at the network seam by asserting the exact PUT body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '#/lib/api/client'
import {
  fetchMfaSettings,
  updateMfaSettings,
  mfaSettingsQueryOptions,
} from '#/lib/system/mfaSettings'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn() },
  API_BASE: '/api/v1',
}))

const getMock = vi.mocked(api.get)
const putMock = vi.mocked(api.put)

const okJson = <T,>(body: T) => ({ json: () => Promise.resolve(body) }) as never

beforeEach(() => {
  getMock.mockReset()
  putMock.mockReset()
})

describe('fetchMfaSettings', () => {
  it('GETs admin/mfa/settings and returns the settings', async () => {
    getMock.mockReturnValue(okJson({ enabled: true, enforced: false }))
    const result = await fetchMfaSettings()
    expect(getMock).toHaveBeenCalledWith('admin/mfa/settings')
    expect(result).toEqual({ enabled: true, enforced: false })
  })
})

describe('updateMfaSettings', () => {
  it('PUTs admin/mfa/settings with BOTH enabled and enforced', async () => {
    putMock.mockReturnValue(okJson({ enabled: true, enforced: true }))
    await updateMfaSettings({ enabled: true, enforced: true })
    expect(putMock).toHaveBeenCalledWith('admin/mfa/settings', {
      json: { enabled: true, enforced: true },
    })
    const body = putMock.mock.calls[0][1]?.json as Record<string, unknown>
    expect(body).toHaveProperty('enabled')
    expect(body).toHaveProperty('enforced')
  })

  it('still sends both fields when enabled is turned off', async () => {
    putMock.mockReturnValue(okJson({ enabled: false, enforced: true }))
    await updateMfaSettings({ enabled: false, enforced: true })
    expect(putMock).toHaveBeenCalledWith('admin/mfa/settings', {
      json: { enabled: false, enforced: true },
    })
  })

  it('returns the server response', async () => {
    putMock.mockReturnValue(okJson({ enabled: false, enforced: false }))
    const result = await updateMfaSettings({ enabled: true, enforced: true })
    expect(result).toEqual({ enabled: false, enforced: false })
  })
})

describe('mfaSettingsQueryOptions', () => {
  it('keys on the admin mfa-settings tuple and does not retry', () => {
    const options = mfaSettingsQueryOptions()
    expect(options.queryKey).toEqual(['admin', 'mfa-settings'])
    expect(options.retry).toBe(false)
  })
})
