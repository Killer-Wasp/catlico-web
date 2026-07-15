/**
 * Data-fetching layer for the ATT&CK catalog, matrix stats, and case
 * procedures — follows the project's TanStack Query pattern (see
 * docs/data-fetching.md and casesQueries.ts for the reference).
 */
import { queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

// --- API DTOs (mirror app/models/pattern.py) --------------------------------

export type PatternDto = {
  id: string
  external_id: string
  name: string
  description: string
  tactics: string[]
  url: string
  parent_external_id: string | null
  created_at: string
}

/** An entity that can carry TTPs — a case or an alert (§4.1a). */
export type ProcedureEntityType = 'case' | 'alert'

export type ProcedureDto = {
  id: string
  case_id: number | null
  alert_id: number | null
  pattern_id: string
  pattern: PatternDto | null
  description: string
  created_at: string
}

export type PatternCaseSummaryDto = {
  id: number
  title: string
  severity: number
  status: string
  created_at: string
}

export type AttackImportResult = {
  created: number
  updated: number
  total: number
}

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

// --- query keys --------------------------------------------------------------

export const attackKeys = {
  all: ['attack'] as const,
  catalog: () => [...attackKeys.all, 'catalog'] as const,
  caseStats: () => [...attackKeys.all, 'case-stats'] as const,
  techniqueCasesAll: () => [...attackKeys.all, 'technique-cases'] as const,
  techniqueCases: (externalId: string) =>
    [...attackKeys.techniqueCasesAll(), externalId] as const,
  procedures: (entityType: ProcedureEntityType, entityId: string) =>
    [...attackKeys.all, 'procedures', entityType, entityId] as const,
}

/** Strip the display prefix from a case (`#123`) or alert (`AL-123`) id. */
const stripEntityPrefix = (id: string) => id.replace(/^(#|AL-)/, '')

/** Path of an entity's procedures collection (`cases|alerts/{id}/procedures`). */
function proceduresEndpoint(
  entityType: ProcedureEntityType,
  entityId: string,
): string {
  const numeric = stripEntityPrefix(entityId)
  return entityType === 'alert'
    ? `alerts/${numeric}/procedures`
    : `cases/${numeric}/procedures`
}

// --- fetchers ----------------------------------------------------------------

async function fetchCatalog(): Promise<PatternDto[]> {
  // The full catalog (~900 techniques) fits one page; limit=2000 fetches it in one shot.
  const page = await api
    .get('patterns', { searchParams: { limit: '2000' } })
    .json<Page<PatternDto>>()
  return page.items
}

async function fetchCaseStats(): Promise<Record<string, number>> {
  return api.get('patterns/case-stats').json<Record<string, number>>()
}

async function fetchTechniqueCases(
  externalId: string,
): Promise<PatternCaseSummaryDto[]> {
  return api
    .get(`patterns/${externalId}/cases`)
    .json<PatternCaseSummaryDto[]>()
}

async function fetchProcedures(
  entityType: ProcedureEntityType,
  entityId: string,
): Promise<ProcedureDto[]> {
  return api.get(proceduresEndpoint(entityType, entityId)).json<ProcedureDto[]>()
}

// --- mutations ----------------------------------------------------------------

/** One TTP link to persist; external_id is required, the rest enriches
 *  auto-imported patterns the catalog doesn't know yet. */
export type ProcedureInput = {
  external_id: string
  name?: string
  description?: string
}

export async function replaceProcedures(
  entityType: ProcedureEntityType,
  entityId: string,
  procedures: ProcedureInput[],
): Promise<ProcedureDto[]> {
  return api
    .put(proceduresEndpoint(entityType, entityId), { json: { procedures } })
    .json<ProcedureDto[]>()
}

export async function importAttackCatalog(): Promise<AttackImportResult> {
  return api.post('patterns/import-attack').json<AttackImportResult>()
}

/** Procedures changed for an entity: refresh that entity's TTPs, plus the
 *  org-wide case matrix stats when a *case*'s TTPs changed (alert TTPs never
 *  feed the case matrix, so their invalidation is skipped). The technique-cases
 *  invalidation is a prefix match across all techniques. */
export function invalidateProcedureQueries(
  qc: QueryClient,
  entityType: ProcedureEntityType,
  entityId: string,
) {
  qc.invalidateQueries({
    queryKey: attackKeys.procedures(entityType, entityId),
  })
  if (entityType === 'case') {
    qc.invalidateQueries({ queryKey: attackKeys.caseStats() })
    qc.invalidateQueries({ queryKey: attackKeys.techniqueCasesAll() })
  }
}

/** Catalog changed (import ran): refetch catalog-derived queries. */
export function invalidateCatalogQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: attackKeys.catalog() })
}

// --- query options -------------------------------------------------------------

/** The catalog only changes when an admin re-imports, so cache it hard. */
export const attackCatalogQueryOptions = () =>
  queryOptions({
    queryKey: attackKeys.catalog(),
    queryFn: fetchCatalog,
    staleTime: 30 * 60_000,
  })

export const attackCaseStatsQueryOptions = () =>
  queryOptions({
    queryKey: attackKeys.caseStats(),
    queryFn: fetchCaseStats,
  })

export const techniqueCasesQueryOptions = (externalId: string) =>
  queryOptions({
    queryKey: attackKeys.techniqueCases(externalId),
    queryFn: () => fetchTechniqueCases(externalId),
  })

export const proceduresQueryOptions = (
  entityType: ProcedureEntityType,
  entityId: string,
) =>
  queryOptions({
    queryKey: attackKeys.procedures(entityType, entityId),
    queryFn: () => fetchProcedures(entityType, entityId),
  })
