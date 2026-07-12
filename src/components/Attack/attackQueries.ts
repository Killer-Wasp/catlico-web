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

export type ProcedureDto = {
  id: string
  case_id: number
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
  procedures: (caseId: string) =>
    [...attackKeys.all, 'procedures', caseId] as const,
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

async function fetchCaseProcedures(caseId: string): Promise<ProcedureDto[]> {
  const numeric = caseId.replace(/^#/, '')
  return api.get(`cases/${numeric}/procedures`).json<ProcedureDto[]>()
}

// --- mutations ----------------------------------------------------------------

/** One TTP link to persist; external_id is required, the rest enriches
 *  auto-imported patterns the catalog doesn't know yet. */
export type ProcedureInput = {
  external_id: string
  name?: string
  description?: string
}

export async function replaceCaseProcedures(
  caseId: string,
  procedures: ProcedureInput[],
): Promise<ProcedureDto[]> {
  const numeric = caseId.replace(/^#/, '')
  return api
    .put(`cases/${numeric}/procedures`, { json: { procedures } })
    .json<ProcedureDto[]>()
}

export async function importAttackCatalog(): Promise<AttackImportResult> {
  return api.post('patterns/import-attack').json<AttackImportResult>()
}

/** Procedures changed for a case: refresh that case's TTPs + org-wide stats
 *  (the technique-cases invalidation is a prefix match across all techniques). */
export function invalidateProcedureQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: attackKeys.procedures(caseId) })
  qc.invalidateQueries({ queryKey: attackKeys.caseStats() })
  qc.invalidateQueries({ queryKey: attackKeys.techniqueCasesAll() })
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

export const caseProceduresQueryOptions = (caseId: string) =>
  queryOptions({
    queryKey: attackKeys.procedures(caseId),
    queryFn: () => fetchCaseProcedures(caseId),
  })
