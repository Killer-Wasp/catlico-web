import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type {
  ProposedAction,
  ProposedActionPublic,
  ProposedActionStatus,
  ProposedActionType,
} from './plugins.types'

// ── Query key factory ───────────────────────────────────────────────────────

export const proposedActionKeys = {
  all: ['proposed-actions'] as const,
  lists: () => [...proposedActionKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...proposedActionKeys.lists(), filters] as const,
}

// ── DTO mapping ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, ProposedActionStatus> = {
  proposed: 'proposed',
  approved: 'approved',
  rejected: 'rejected',
  applied: 'applied',
  failed: 'failed',
  expired: 'expired',
  superseded: 'superseded',
}

const TYPE_MAP: Record<string, ProposedActionType> = {
  add_tag: 'add_tag',
  create_task: 'create_task',
  append_task_log: 'append_task_log',
  add_related_observable: 'add_related_observable',
  change_severity_status: 'change_severity_status',
  patch_case_description: 'patch_case_description',
}

function toProposedAction(dto: ProposedActionPublic): ProposedAction {
  return {
    id: dto.id,
    pluginId: dto.plugin_id,
    pluginRunId: dto.plugin_run_id,
    actionType: TYPE_MAP[dto.action_type] ?? ('add_tag'),
    entityType: dto.entity_type,
    entityId: dto.entity_id,
    payload: dto.payload,
    status: STATUS_MAP[dto.status] ?? 'proposed',
    decisionReason: dto.decision_reason,
    decidedBy: dto.decided_by,
    decidedAt: dto.decided_at,
    createdAt: dto.created_at,
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ProposedActionFilter = {
  entity_type?: string
  entity_id?: string
  plugin_id?: string
  status?: string
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchProposedActions(
  filters?: ProposedActionFilter,
  tokenFilters?: FilterClause[],
): Promise<ProposedAction[]> {
  const params = new URLSearchParams()
  if (filters?.entity_type) params.set('entity_type', filters.entity_type)
  if (filters?.entity_id) params.set('entity_id', filters.entity_id)
  if (filters?.plugin_id) params.set('plugin_id', filters.plugin_id)
  if (filters?.status) params.set('status_filter', filters.status)
  appendClauses(params, tokenFilters)

  const dtos = await api
    .get(`proposed-actions?${params.toString()}`)
    .json<ProposedActionPublic[]>()
  return dtos.map(toProposedAction)
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function approveProposedAction(
  id: string,
): Promise<ProposedAction> {
  const dto = await api
    .post(`proposed-actions/${id}/approve`)
    .json<ProposedActionPublic>()
  return toProposedAction(dto)
}

export async function rejectProposedAction(
  id: string,
): Promise<ProposedAction> {
  const dto = await api
    .post(`proposed-actions/${id}/reject`)
    .json<ProposedActionPublic>()
  return toProposedAction(dto)
}

// ── queryOptions units ──────────────────────────────────────────────────────

export const proposedActionsQueryOptions = (
  filters?: ProposedActionFilter,
  tokenFilters?: FilterClause[],
) =>
  queryOptions({
    queryKey: proposedActionKeys.list({ ...filters, tokenFilters }),
    queryFn: () => fetchProposedActions(filters, tokenFilters),
  })
