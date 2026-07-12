import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId, getSessionOrganisationIds } from '#/lib/auth/session'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type OrganisationPublic = {
  id: string
  name: string
  description: string
  timezone: string
  default_tlp: number
  created_at: string
  updated_at: string | null
}

export type OrganisationMemberPublic = {
  id: string
  user_id: string
  organisation_id: string
  role_id: string
  email: string
  first_name: string | null
  last_name: string | null
  has_avatar: boolean
  created_at: string
}

export type RolePublic = {
  id: string
  organisation_id: string
  name: string
  permissions: string[]
  created_at: string
}

export type PermissionKind = 'read' | 'write' | 'delete' | 'run'

export type PermissionInfo = {
  key: string
  domain: string
  kind: PermissionKind
  label: string
  description: string
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

export type OrganisationMemberCreateInput = {
  role_id: string
} & (
  | { user_id: string }
  | { email: string; first_name?: string; last_name?: string }
)

export type OrganisationMemberUpdateInput = {
  role_id: string
}

export type RoleCreateInput = {
  name: string
  permissions: string[]
}

export type RoleUpdateInput = {
  permissions: string[]
}

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
  accessibleOrganisations: () =>
    [...settingsKeys.all, 'accessible-organisations'] as const,
  members: (orgId: string) => [...settingsKeys.all, 'members', orgId] as const,
  roles: () => [...settingsKeys.all, 'roles'] as const,
  customFields: (filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS) =>
    [...settingsKeys.all, 'custom-fields', filters] as const,
  audits: (filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS) =>
    [...settingsKeys.all, 'audits', filters] as const,
  observableTypes: () => [...settingsKeys.all, 'observable-types'] as const,
  tags: (namespace: string | undefined) =>
    [...settingsKeys.all, 'tags', namespace] as const,
  links: (orgId: string) => [...settingsKeys.all, 'links', orgId] as const,
  apiKeys: (orgId: string) => [...settingsKeys.all, 'api-keys', orgId] as const,
  slaPolicies: (orgId: string) =>
    [...settingsKeys.all, 'sla-policies', orgId] as const,
  notifiers: (orgId: string) =>
    [...settingsKeys.all, 'notifiers', orgId] as const,
  notificationRules: (orgId: string) =>
    [...settingsKeys.all, 'notification-rules', orgId] as const,
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
  patch: Partial<
    Pick<
      OrganisationPublic,
      'name' | 'description' | 'timezone' | 'default_tlp'
    >
  >,
  orgId = activeOrgId(),
): Promise<OrganisationPublic> {
  return api
    .patch(`organisations/${orgId}`, { json: patch })
    .json<OrganisationPublic>()
}

export async function fetchOrganisations(): Promise<OrganisationPublic[]> {
  return api.get('organisations/').json<OrganisationPublic[]>()
}

export async function fetchAccessibleOrganisations(): Promise<
  OrganisationPublic[]
> {
  const orgIds = getSessionOrganisationIds()
  if (orgIds.length === 0) return fetchOrganisations()
  return Promise.all(orgIds.map((orgId) => fetchOrganisationProfile(orgId)))
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

export async function fetchPermissionCatalog(): Promise<PermissionInfo[]> {
  return api.get('permissions/').json<PermissionInfo[]>()
}

export const permissionCatalogQueryOptions = () =>
  queryOptions({
    queryKey: [...settingsKeys.all, 'permission-catalog'] as const,
    queryFn: fetchPermissionCatalog,
    staleTime: Infinity,
  })

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

export async function createOrganisationMember(
  input: OrganisationMemberCreateInput,
  orgId = activeOrgId(),
): Promise<OrganisationMemberPublic> {
  return api
    .post(`organisations/${orgId}/members`, { json: input })
    .json<OrganisationMemberPublic>()
}

export async function updateOrganisationMember(
  userId: string,
  input: OrganisationMemberUpdateInput,
  orgId = activeOrgId(),
): Promise<OrganisationMemberPublic> {
  return api
    .patch(`organisations/${orgId}/members/${userId}`, { json: input })
    .json<OrganisationMemberPublic>()
}

export async function removeOrganisationMember(
  userId: string,
  orgId = activeOrgId(),
): Promise<void> {
  await api.delete(`organisations/${orgId}/members/${userId}`)
}

export async function createRole(input: RoleCreateInput): Promise<RolePublic> {
  return api.post('roles/', { json: input }).json<RolePublic>()
}

export async function updateRole(
  roleId: string,
  input: RoleUpdateInput,
): Promise<RolePublic> {
  return api.patch(`roles/${roleId}`, { json: input }).json<RolePublic>()
}

export async function deleteRole(roleId: string): Promise<void> {
  await api.delete(`roles/${roleId}`)
}

export type AuditPublic = {
  id: number
  request_id: string
  action: string
  main_action: boolean
  object_type: string
  object_id: string
  context_type: string | null
  context_id: string | null
  actor: string
  details: Record<string, unknown> | null
  created_at: string
}

export type AuditListResult = {
  items: AuditPublic[]
  total: number
}

export async function fetchAudits(
  filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS,
): Promise<AuditListResult> {
  const searchParams = {
    limit: String(filters.limit ?? DEFAULT_SETTINGS_FILTERS.limit),
    skip: String(filters.skip ?? DEFAULT_SETTINGS_FILTERS.skip),
  }
  return api.get('audit/', { searchParams }).json<AuditListResult>()
}

export const auditsQueryOptions = (
  filters: SettingsListFilters = DEFAULT_SETTINGS_FILTERS,
) =>
  queryOptions({
    queryKey: settingsKeys.audits(filters),
    queryFn: () => fetchAudits(filters),
  })

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

export const accessibleOrganisationsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.accessibleOrganisations(),
    queryFn: fetchAccessibleOrganisations,
    retry: false,
  })

// Defensive default: read the active org without throwing so a component that
// renders before an org is selected simply gets a disabled (empty) query rather
// than crashing. Mutations still use `activeOrgId()` and throw when it's absent.
export const organisationMembersQueryOptions = (orgId = getActiveOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.members(orgId ?? ''),
    queryFn: () => fetchOrganisationMembers(orgId ?? ''),
    enabled: Boolean(orgId),
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

export type ObservableTypePublic = {
  name: string
  is_attachment: boolean
}

export type ObservableTypeCreateInput = {
  name: string
  is_attachment: boolean
}

export async function fetchObservableTypes(): Promise<ObservableTypePublic[]> {
  return api.get('observable-types/').json<ObservableTypePublic[]>()
}

export async function createObservableType(
  input: ObservableTypeCreateInput,
): Promise<ObservableTypePublic> {
  return api
    .post('observable-types/', { json: input })
    .json<ObservableTypePublic>()
}

export async function deleteObservableType(name: string): Promise<void> {
  // The name is the path id and may contain characters that need escaping.
  await api.delete(`observable-types/${encodeURIComponent(name)}`)
}

export const observableTypesQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.observableTypes(),
    queryFn: fetchObservableTypes,
  })

export type TagPublic = {
  id: number
  namespace: string
  predicate: string
  value: string
  colour: string
  tag: string
}

export async function fetchTags(namespace?: string): Promise<TagPublic[]> {
  const searchParams = namespace ? { namespace } : undefined
  return api.get('tags/', { searchParams }).json<TagPublic[]>()
}

export async function deleteTag(tagId: number): Promise<void> {
  await api.delete(`tags/${tagId}`)
}

/** Create a namespace-less "freetag" — just a predicate word. The backend 409s
 * on a duplicate. Superadmin-only (matches the tags create/delete guard). */
export async function createFreetag(predicate: string): Promise<TagPublic> {
  return api
    .post('tags/', { json: { predicate, namespace: '', value: '' } })
    .json<TagPublic>()
}

export const tagsQueryOptions = (namespace?: string) =>
  queryOptions({
    queryKey: settingsKeys.tags(namespace),
    queryFn: () => fetchTags(namespace),
  })

export type OrganisationLinkPublic = {
  from_org_id: string
  to_org_id: string
  case_sharing: 'manual' | 'supervised' | 'notify'
  task_sharing: 'manual' | 'autoShare'
  observable_sharing: 'manual' | 'autoShare'
}

export type OrganisationLinkCreateInput = {
  to_org_id: string
  case_sharing?: OrganisationLinkPublic['case_sharing']
  task_sharing?: OrganisationLinkPublic['task_sharing']
  observable_sharing?: OrganisationLinkPublic['observable_sharing']
}

export async function fetchOrganisationLinks(
  orgId = activeOrgId(),
): Promise<OrganisationLinkPublic[]> {
  return api
    .get(`organisations/${orgId}/links`)
    .json<OrganisationLinkPublic[]>()
}

export async function createOrganisationLink(
  input: OrganisationLinkCreateInput,
  orgId = activeOrgId(),
): Promise<OrganisationLinkPublic> {
  return api
    .post(`organisations/${orgId}/links`, { json: input })
    .json<OrganisationLinkPublic>()
}

export async function deleteOrganisationLink(
  toOrgId: string,
  orgId = activeOrgId(),
): Promise<void> {
  await api.delete(`organisations/${orgId}/links/${toOrgId}`)
}

// --- API Keys ---------------------------------------------------------------

export type ApiKeyPublic = {
  id: string
  name: string
  prefix: string
  last_four: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  organisation_id: string
  created_at: string
}

export type ApiKeyCreated = ApiKeyPublic & { key: string }

export type ApiKeyCreateInput = {
  name: string
  scopes?: string[]
  expires_at?: string | null
}

export async function fetchApiKeys(
  _orgId = activeOrgId(),
): Promise<ApiKeyPublic[]> {
  return api.get('api-keys/').json<ApiKeyPublic[]>()
}

export async function createApiKey(
  input: ApiKeyCreateInput,
): Promise<ApiKeyCreated> {
  return api.post('api-keys/', { json: input }).json<ApiKeyCreated>()
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await api.delete(`api-keys/${keyId}`)
}

export const apiKeysQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.apiKeys(orgId),
    queryFn: () => fetchApiKeys(orgId),
  })

// --- SLA Policies -----------------------------------------------------------

export type SlaPolicyPublic = {
  id: number
  severity: number
  ack_seconds: number
  resolve_seconds: number
  escalation_target: string
  enabled: boolean
  organisation_id: string
  created_at: string
  updated_at: string | null
}

export type SlaPolicyUpsertInput = {
  severity: number
  ack_seconds: number
  resolve_seconds: number
  escalation_target?: string
  enabled?: boolean
}

export async function fetchSlaPolicies(): Promise<Page<SlaPolicyPublic>> {
  return api.get('sla-policies/').json<Page<SlaPolicyPublic>>()
}

export async function upsertSlaPolicies(
  policies: SlaPolicyUpsertInput[],
): Promise<SlaPolicyPublic[]> {
  return api.put('sla-policies/', { json: policies }).json<SlaPolicyPublic[]>()
}

export async function deleteSlaPolicy(id: number): Promise<void> {
  await api.delete(`sla-policies/${id}`)
}

export const slaPoliciesQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.slaPolicies(orgId),
    queryFn: fetchSlaPolicies,
  })

// --- Notifiers --------------------------------------------------------------

export type NotifierPublic = {
  id: string
  type: 'slack' | 'email' | 'webhook' | 'kafka'
  target: string
  config: Record<string, unknown>
  enabled: boolean
  has_secrets: boolean
  organisation_id: string
  created_at: string
  updated_at: string | null
}

export type NotifierCreateInput = {
  type: NotifierPublic['type']
  target?: string
  config?: Record<string, unknown>
  secrets?: Record<string, unknown>
  enabled?: boolean
}

export type NotifierUpdateInput = Partial<NotifierCreateInput>

export async function fetchNotifiers(): Promise<Page<NotifierPublic>> {
  return api.get('notifications/notifiers/').json<Page<NotifierPublic>>()
}

export async function createNotifier(
  input: NotifierCreateInput,
): Promise<NotifierPublic> {
  return api
    .post('notifications/notifiers/', { json: input })
    .json<NotifierPublic>()
}

export async function updateNotifier(
  id: string,
  patch: NotifierUpdateInput,
): Promise<NotifierPublic> {
  return api
    .patch(`notifications/notifiers/${id}`, { json: patch })
    .json<NotifierPublic>()
}

export async function deleteNotifier(id: string): Promise<void> {
  await api.delete(`notifications/notifiers/${id}`)
}

export const notifiersQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.notifiers(orgId),
    queryFn: fetchNotifiers,
  })

// --- Notification Rules -----------------------------------------------------

export type NotificationRulePublic = {
  id: string
  name: string
  description: string
  event: string | null
  enabled: boolean
  notifier_ids: string[]
  organisation_id: string
  created_at: string
  updated_at: string | null
}

export type NotificationRuleUpdateInput = Partial<
  Pick<
    NotificationRulePublic,
    'name' | 'description' | 'event' | 'enabled' | 'notifier_ids'
  >
>

export async function fetchNotificationRules(): Promise<
  Page<NotificationRulePublic>
> {
  return api
    .get('notifications/notification-rules/')
    .json<Page<NotificationRulePublic>>()
}

export async function updateNotificationRule(
  id: string,
  patch: NotificationRuleUpdateInput,
): Promise<NotificationRulePublic> {
  return api
    .patch(`notifications/notification-rules/${id}`, { json: patch })
    .json<NotificationRulePublic>()
}

export const notificationRulesQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: settingsKeys.notificationRules(orgId),
    queryFn: fetchNotificationRules,
  })
