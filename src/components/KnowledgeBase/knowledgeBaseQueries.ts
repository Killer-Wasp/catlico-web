import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type KnowledgeBaseBlock =
  | { type: 'paragraph'; text: string; code?: string }
  | { type: 'section'; title: string; items: string[] }
  | { type: 'list'; items: string[] }

export type KnowledgeBasePagePublic = {
  id: number
  title: string
  summary: string
  tags: string[]
  blocks: KnowledgeBaseBlock[]
  organisation_id: string
  created_by: string
  created_at: string
  updated_at: string | null
}

export type KnowledgeBasePageCreateInput = {
  title: string
  summary?: string
  tags?: string[]
  blocks?: KnowledgeBaseBlock[]
}

export type KnowledgeBasePageUpdateInput = {
  title?: string
  summary?: string
  tags?: string[]
  blocks?: KnowledgeBaseBlock[]
}

export const kbKeys = {
  all: ['knowledge-base'] as const,
  lists: () => [...kbKeys.all, 'list'] as const,
  list: (orgId: string) => [...kbKeys.lists(), orgId] as const,
  details: () => [...kbKeys.all, 'detail'] as const,
  detail: (id: number) => [...kbKeys.details(), id] as const,
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

export const knowledgeBaseQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: kbKeys.list(orgId),
    queryFn: fetchKnowledgeBasePages,
  })
