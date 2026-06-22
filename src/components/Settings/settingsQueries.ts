import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type OrganisationPublic = {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string | null
}

export type OrganisationMemberPublic = {
  id: string
  user_id: string
  organisation_id: string
  role_id: string
  email: string
  created_at: string
}

export type RolePublic = {
  id: string
  name: string
  permissions: string[]
  created_at: string
}

export type CustomFieldPublic = {
  id: number
  name: string
  display_name: string
  description: string
  field_type: 'string' | 'integer' | 'float' | 'boolean' | 'date'
  options: string[]
  mandatory: boolean
  organisation_id: string
  created_at: string
  updated_at: string | null
}

export type CustomFieldsResult = {
  fields: CustomFieldPublic[]
  total: number
}

export type OrganisationCreateInput = Pick<
  OrganisationPublic,
  'id' | 'name' | 'description'
>

export type CustomFieldCreateInput = {
  name: string
  display_name: string
  description: string
  field_type: CustomFieldPublic['field_type']
  options: string[]
  mandatory: boolean
}

export type CustomFieldUpdateInput = Partial<
  Pick<
    CustomFieldCreateInput,
    'display_name' | 'description' | 'options' | 'mandatory'
  >
>

export type SettingsListFilters = {
  skip?: number
  limit?: number
}

export const DEFAULT_SETTINGS_FILTERS = {
  skip: 0,
  limit: 100,
} as const satisfies Required<SettingsListFilters>

export const settingsKeys = {
  all: ['settings'] as const,
  organisation: (orgId: string) =>
    [...settingsKeys.all, 'organisation', orgId] as const,
  organisations: () => [...settingsKeys.all, 'organisations'] as const,
  members: (orgId: string) => [...settingsKeys.all, 'members', orgId] as const,
  roles: () => [...settingsKeys.all, 'roles'] as const,
  customFields: (filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS) =>
    [...settingsKeys.all, 'custom-fields', filters] as const,
}

function activeOrgId(): string {
  const orgId = getActiveOrgId()
  if (!orgId) throw new Error('No active organisation is selected.')
  return orgId
}

export async function fetchOrganisationProfile(
  orgId = activeOrgId(),
): Promise<OrganisationPublic> {
  return api.get(`organisations/${orgId}`).json<OrganisationPublic>()
}

export async function updateOrganisationProfile(
  patch: Pick<OrganisationPublic, 'name' | 'description'>,
  orgId = activeOrgId(),
): Promise<OrganisationPublic> {
  return api
    .patch(`organisations/${orgId}`, { json: patch })
    .json<OrganisationPublic>()
}

export async function fetchOrganisations(): Promise<OrganisationPublic[]> {
  return api.get('organisations/').json<OrganisationPublic[]>()
}

export async function createOrganisation(
  input: OrganisationCreateInput,
): Promise<OrganisationPublic> {
  return api.post('organisations/', { json: input }).json<OrganisationPublic>()
}

export async function deleteOrganisation(orgId: string): Promise<void> {
  await api.delete(`organisations/${orgId}`)
}

export async function fetchOrganisationMembers(
  orgId = activeOrgId(),
): Promise<OrganisationMemberPublic[]> {
  return api
    .get(`organisations/${orgId}/members`)
    .json<OrganisationMemberPublic[]>()
}

export async function fetchRoles(): Promise<RolePublic[]> {
  return api.get('roles/').json<RolePublic[]>()
}

export async function fetchCustomFields(
  filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS,
): Promise<CustomFieldsResult> {
  const searchParams = {
    limit: String(filters.limit ?? DEFAULT_SETTINGS_FILTERS.limit),
    skip: String(filters.skip ?? DEFAULT_SETTINGS_FILTERS.skip),
  }
  const page = await api
    .get('custom-fields/', { searchParams })
    .json<Page<CustomFieldPublic>>()
  return { fields: page.items, total: page.total }
}

export async function createCustomField(
  input: CustomFieldCreateInput,
): Promise<CustomFieldPublic> {
  return api.post('custom-fields/', { json: input }).json<CustomFieldPublic>()
}

export async function updateCustomField(
  fieldId: number,
  patch: CustomFieldUpdateInput,
): Promise<CustomFieldPublic> {
  return api
    .patch(`custom-fields/${fieldId}`, { json: patch })
    .json<CustomFieldPublic>()
}

export async function deleteCustomField(fieldId: number): Promise<void> {
  await api.delete(`custom-fields/${fieldId}`)
}

export const organisationProfileQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.organisation(orgId),
    queryFn: () => fetchOrganisationProfile(orgId),
  })

export const organisationsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.organisations(),
    queryFn: fetchOrganisations,
    retry: false,
  })

export const organisationMembersQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.members(orgId),
    queryFn: () => fetchOrganisationMembers(orgId),
  })

export const rolesQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.roles(),
    queryFn: fetchRoles,
    retry: false,
  })

export const customFieldsQueryOptions = (
  filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS,
) =>
  queryOptions({
    queryKey: settingsKeys.customFields(filters),
    queryFn: () => fetchCustomFields(filters),
  })
