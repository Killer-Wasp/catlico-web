import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

type FunctionRunPublic = {
  id: string
  status: 'success' | 'failure'
  trigger: string
  started_at: string
  duration_ms: number
  attempts: number
  error: string | null
}

export type FunctionPublic = {
  id: number
  name: string
  description: string
  runtime: 'javascript' | 'python'
  trigger: 'scheduled' | 'event' | 'manual' | 'api'
  trigger_config: Record<string, unknown>
  profile: string
  enabled: boolean
  timeout_ms: number
  egress: string
  approval: boolean
  code: string
  secrets: string[]
  run_count: number
  error_count: number
  organisation_id: string
  created_at: string
  updated_at: string | null
  runs: FunctionRunPublic[]
}

export type FunctionCreateInput = {
  name: string
  description?: string
  runtime?: 'javascript' | 'python'
  trigger?: 'scheduled' | 'event' | 'manual' | 'api'
  trigger_config?: Record<string, unknown>
  profile?: string
  enabled?: boolean
  timeout_ms?: number
  egress?: string
  approval?: boolean
  code?: string
  secrets?: string[]
}

export type FunctionUpdateInput = Partial<FunctionCreateInput>

export const functionKeys = {
  all: ['functions'] as const,
  lists: () => [...functionKeys.all, 'list'] as const,
  list: (orgId: string) => [...functionKeys.lists(), orgId] as const,
  details: () => [...functionKeys.all, 'detail'] as const,
  detail: (id: number) => [...functionKeys.details(), id] as const,
}

function activeOrgId(): string {
  const orgId = getActiveOrgId()
  if (!orgId) throw new Error('No active organisation is selected.')
  return orgId
}

export async function fetchFunctions(): Promise<Page<FunctionPublic>> {
  return api.get('functions/').json<Page<FunctionPublic>>()
}

export async function createFunction(
  input: FunctionCreateInput,
): Promise<FunctionPublic> {
  return api.post('functions/', { json: input }).json<FunctionPublic>()
}

export async function updateFunction(
  id: number,
  input: FunctionUpdateInput,
): Promise<FunctionPublic> {
  return api.patch(`functions/${id}`, { json: input }).json<FunctionPublic>()
}

export async function deleteFunction(id: number): Promise<void> {
  await api.delete(`functions/${id}`)
}

export const functionsQueryOptions = (orgId = activeOrgId()) =>
  queryOptions({
    queryKey: functionKeys.list(orgId),
    queryFn: fetchFunctions,
  })
