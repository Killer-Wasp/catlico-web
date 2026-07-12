import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type KnowledgeBaseContributor = {
  id: string
  email: string
  last_edited_at: string
}

export type KnowledgeBasePageVersionPublic = {
  id: number
  page_id: number
  version_number: number
  action: 'create' | 'update' | 'revert' | 'import'
  snapshot: {
    title: string
    summary: string
    tags: string[]
    content: string
  }
  changed_fields: string[]
  edited_by: string
  edited_by_email: string
  edited_at: string
  reverted_from_version_id: number | null
}

export type KnowledgeBasePagePublic = {
  id: number
  title: string
  summary: string
  tags: string[]
  content: string
  organisation_id: string
  created_by: string
  created_at: string
  updated_at: string | null
  contributors?: KnowledgeBaseContributor[]
  last_edited_by?: KnowledgeBaseContributor | null
}

export type KnowledgeBasePageExport = {
  page: KnowledgeBasePagePublic
  versions: KnowledgeBasePageVersionPublic[]
}

export type KnowledgeBasePageCreateInput = {
  title: string
  summary?: string
  tags?: string[]
  content?: string
}

export type KnowledgeBasePageUpdateInput = {
  title?: string
  summary?: string
  tags?: string[]
  content?: string
}

export const kbKeys = {
  all: ['knowledge-base'] as const,
  lists: () => [...kbKeys.all, 'list'] as const,
  list: (orgId: string) => [...kbKeys.lists(), orgId] as const,
  details: () => [...kbKeys.all, 'detail'] as const,
  detail: (id: number) => [...kbKeys.details(), id] as const,
  versions: (id: number) => [...kbKeys.detail(id), 'versions'] as const,
}

function activeOrgId(): string {
  const orgId = getActiveOrgId()
  if (!orgId) throw new Error('No active organisation is selected.')
  return orgId
}

export async function fetchKnowledgeBasePages(): Promise<Page<KnowledgeBasePagePublic>> {
  return api.get('knowledge-base/').json<Page<KnowledgeBasePagePublic>>()
}

export async function createKnowledgeBasePage(
  input: KnowledgeBasePageCreateInput,
): Promise<KnowledgeBasePagePublic> {
  return api
    .post('knowledge-base/', { json: input })
    .json<KnowledgeBasePagePublic>()
}

export async function updateKnowledgeBasePage(
  id: number,
  input: KnowledgeBasePageUpdateInput,
): Promise<KnowledgeBasePagePublic> {
  return api
    .patch(`knowledge-base/${id}`, { json: input })
    .json<KnowledgeBasePagePublic>()
}

export async function deleteKnowledgeBasePage(id: number): Promise<void> {
  await api.delete(`knowledge-base/${id}`)
}

export async function fetchKnowledgeBasePageVersions(
  id: number,
): Promise<KnowledgeBasePageVersionPublic[]> {
  return api.get(`knowledge-base/${id}/versions`).json<KnowledgeBasePageVersionPublic[]>()
}

export async function revertKnowledgeBasePage(
  pageId: number,
  versionId: number,
): Promise<KnowledgeBasePagePublic> {
  return api
    .post(`knowledge-base/${pageId}/versions/${versionId}/revert`)
    .json<KnowledgeBasePagePublic>()
}

export async function exportKnowledgeBasePage(
  id: number,
): Promise<KnowledgeBasePageExport> {
  return api.get(`knowledge-base/${id}/export`).json<KnowledgeBasePageExport>()
}

export async function importKnowledgeBasePage(
  document: KnowledgeBasePageExport,
): Promise<KnowledgeBasePagePublic> {
  return api
    .post('knowledge-base/import', { json: document })
    .json<KnowledgeBasePagePublic>()
}

export const knowledgeBaseQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: kbKeys.list(orgId),
    queryFn: fetchKnowledgeBasePages,
  })
