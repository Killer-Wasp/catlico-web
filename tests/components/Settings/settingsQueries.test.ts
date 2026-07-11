// @vitest-environment jsdom
import {
  createOrganisation,
  createCustomField,
  customFieldsQueryOptions,
  deleteCustomField,
  deleteOrganisation,
  fetchAccessibleOrganisations,
  fetchCustomFields,
  fetchOrganisationMembers,
  fetchOrganisationProfile,
  settingsKeys,
  updateCustomField,
  updateOrganisationProfile,
} from '#/components/pages/settings/settingsQueries'
import { api } from '#/lib/api/client'
import { clearSession, setAccessToken } from '#/lib/auth/session'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

type JsonResponse = { json: () => Promise<unknown> }

function fakeAccessToken(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`
}

beforeEach(() => {
  // Reset the in-memory access token between tests, then seed the active org.
  clearSession()
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.delete).mockReset()
})

describe('settings backend queries', () => {
  test('loads active organisation profile and members from the backend org endpoints', async () => {
    vi.mocked(api.get).mockImplementation(
      (input) =>
        ({
          json: async () =>
            String(input).endsWith('/members')
              ? [
                  {
                    id: 'membership-1',
                    user_id: 'user-1',
                    organisation_id: 'origin-soc',
                    role_id: 'role-1',
                    email: 'analyst@example.test',
                    created_at: '2026-06-12T09:12:00Z',
                  },
                ]
              : {
                  id: 'origin-soc',
                  name: 'Origin SOC',
                  description: 'Primary SOC tenant',
                  timezone: 'UTC',
                  default_tlp: 2,
                  created_at: '2026-06-12T09:12:00Z',
                  updated_at: null,
                },
        }) satisfies JsonResponse as ReturnType<typeof api.get>,
    )

    await expect(fetchOrganisationProfile()).resolves.toMatchObject({
      id: 'origin-soc',
      name: 'Origin SOC',
    })
    await expect(fetchOrganisationMembers()).resolves.toEqual([
      expect.objectContaining({ email: 'analyst@example.test' }),
    ])
    expect(api.get).toHaveBeenCalledWith('organisations/origin-soc')
    expect(api.get).toHaveBeenCalledWith('organisations/origin-soc/members')
  })

  test('loads accessible organisations from token memberships without listing every organisation', async () => {
    setAccessToken(
      fakeAccessToken({ organisations: ['origin-soc', 'partner-acme'] }),
    )
    vi.mocked(api.get).mockImplementation(
      (input) =>
        ({
          json: async () => {
            const id = String(input).replace('organisations/', '')
            return {
              id,
              name: id === 'origin-soc' ? 'Origin SOC' : 'Partner ACME',
              description: '',
              timezone: 'UTC',
              default_tlp: 2,
              created_at: '2026-06-12T09:12:00Z',
              updated_at: null,
            }
          },
        }) satisfies JsonResponse as ReturnType<typeof api.get>,
    )

    await expect(fetchAccessibleOrganisations()).resolves.toEqual([
      expect.objectContaining({ id: 'origin-soc', name: 'Origin SOC' }),
      expect.objectContaining({ id: 'partner-acme', name: 'Partner ACME' }),
    ])
    expect(api.get).toHaveBeenCalledWith('organisations/origin-soc')
    expect(api.get).toHaveBeenCalledWith('organisations/partner-acme')
    expect(api.get).not.toHaveBeenCalledWith('organisations/')
  })

  test('updates active organisation profile through PATCH /organisations/{id}', async () => {
    vi.mocked(api.patch).mockReturnValue({
      json: async () => ({
        id: 'origin-soc',
        name: 'Renamed SOC',
        description: 'Updated tenant',
        timezone: 'UTC',
        default_tlp: 2,
        created_at: '2026-06-12T09:12:00Z',
        updated_at: '2026-06-12T10:12:00Z',
      }),
    } satisfies JsonResponse as ReturnType<typeof api.patch>)

    await updateOrganisationProfile({
      name: 'Renamed SOC',
      description: 'Updated tenant',
    })

    expect(api.patch).toHaveBeenCalledWith('organisations/origin-soc', {
      json: { name: 'Renamed SOC', description: 'Updated tenant' },
    })
  })

  test('creates, updates, and deletes organisations through backend org CRUD', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => ({
        id: 'partner-acme',
        name: 'Managed Partner - Acme',
        description: 'External partner',
        created_at: '2026-06-12T09:12:00Z',
        updated_at: null,
      }),
    } satisfies JsonResponse as ReturnType<typeof api.post>)
    vi.mocked(api.patch).mockReturnValue({
      json: async () => ({
        id: 'partner-acme',
        name: 'Managed Partner - Acme SOC',
        description: 'Updated partner',
        created_at: '2026-06-12T09:12:00Z',
        updated_at: '2026-06-12T10:12:00Z',
      }),
    } satisfies JsonResponse as ReturnType<typeof api.patch>)
    vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)

    await createOrganisation({
      id: 'partner-acme',
      name: 'Managed Partner - Acme',
      description: 'External partner',
    })
    await updateOrganisationProfile(
      {
        name: 'Managed Partner - Acme SOC',
        description: 'Updated partner',
      },
      'partner-acme',
    )
    await deleteOrganisation('partner-acme')

    expect(api.post).toHaveBeenCalledWith('organisations/', {
      json: {
        id: 'partner-acme',
        name: 'Managed Partner - Acme',
        description: 'External partner',
      },
    })
    expect(api.patch).toHaveBeenCalledWith('organisations/partner-acme', {
      json: {
        name: 'Managed Partner - Acme SOC',
        description: 'Updated partner',
      },
    })
    expect(api.delete).toHaveBeenCalledWith('organisations/partner-acme')
  })

  test('loads and mutates custom field definitions', async () => {
    vi.mocked(api.get).mockReturnValue({
      json: async () => ({
        items: [
          {
            id: 4,
            name: 'campaign_id',
            display_name: 'Campaign ID',
            description: '',
            field_type: 'string',
            options: [],
            mandatory: false,
            organisation_id: 'origin-soc',
            created_at: '2026-06-12T09:12:00Z',
            updated_at: null,
          },
        ],
        total: 1,
        skip: 0,
        limit: 100,
      }),
    } satisfies JsonResponse as ReturnType<typeof api.get>)
    vi.mocked(api.post).mockReturnValue({
      json: async () => ({ id: 5 }),
    } as JsonResponse as ReturnType<typeof api.post>)
    vi.mocked(api.patch).mockReturnValue({
      json: async () => ({ id: 4 }),
    } as JsonResponse as ReturnType<typeof api.patch>)
    vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)

    await expect(fetchCustomFields()).resolves.toEqual({
      fields: [expect.objectContaining({ name: 'campaign_id' })],
      total: 1,
    })
    await createCustomField({
      name: 'severity_note',
      display_name: 'Severity note',
      field_type: 'string',
      description: '',
      options: [],
      mandatory: false,
    })
    await updateCustomField(4, { display_name: 'Campaign' })
    await deleteCustomField(4)

    expect(api.get).toHaveBeenCalledWith('custom-fields/', {
      searchParams: { limit: '100', skip: '0' },
    })
    expect(api.post).toHaveBeenCalledWith('custom-fields/', {
      json: expect.objectContaining({ name: 'severity_note' }),
    })
    expect(api.patch).toHaveBeenCalledWith('custom-fields/4', {
      json: { display_name: 'Campaign' },
    })
    expect(api.delete).toHaveBeenCalledWith('custom-fields/4')
  })

  test('exposes stable query keys for settings panels', () => {
    expect(settingsKeys.organisation('origin-soc')).toEqual([
      'settings',
      'organisation',
      'origin-soc',
    ])
    expect(customFieldsQueryOptions().queryKey).toEqual([
      'settings',
      'custom-fields',
      { limit: 100, skip: 0 },
    ])
  })
})
