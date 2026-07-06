import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { Pap, Severity, Tlp } from '#/lib/domain'
import type { CaseTemplate, CaseTemplateTask } from './caseTemplates.types'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type CaseTemplateTaskPublic = {
  id: string
  title: string
  group: string
  description: string
  order: number
}

export type CaseTemplatePublic = {
  id: number
  name: string
  display_name: string
  title_prefix: string
  description: string
  severity: number | null
  tlp: number | null
  pap: number | null
  summary: string | null
  organisation_id: string
  created_by: string
  tasks: CaseTemplateTaskPublic[]
  tags: string[]
  created_at: string
  updated_at: string | null
}

export type CaseTemplateExport = {
  kind: 'catlico.caseTemplate'
  version: number
  name: string
  display_name?: string
  title_prefix?: string
  description?: string
  severity?: number | null
  tlp?: number | null
  pap?: number | null
  summary?: string | null
  tasks?: Array<{
    title: string
    group?: string
    description?: string
    order?: number
  }>
  tags?: string[]
}

export type CaseTemplateListFilters = {
  skip?: number
  limit?: number
}

export type CaseTemplatesResult = {
  templates: CaseTemplate[]
  total: number
}

export const DEFAULT_CASE_TEMPLATE_FILTERS = {
  skip: 0,
  limit: 100,
} as const satisfies Required<CaseTemplateListFilters>

export const caseTemplateKeys = {
  all: ['case-templates'] as const,
  lists: () => [...caseTemplateKeys.all, 'list'] as const,
  list: (filters: CaseTemplateListFilters = DEFAULT_CASE_TEMPLATE_FILTERS) =>
    [...caseTemplateKeys.lists(), filters] as const,
  details: () => [...caseTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseTemplateKeys.details(), id] as const,
}

const clamp = (n: number | null, lo: number, hi: number, fallback: number) =>
  Math.min(hi, Math.max(lo, Math.round(n ?? fallback)))

function compactDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toTemplateTask(task: CaseTemplateTaskPublic): CaseTemplateTask {
  return {
    title: task.title,
    group: task.group || 'General',
    description: task.description,
    assignee: '',
    dueInHours: 0,
    flagged: false,
  }
}

export function toCaseTemplate(dto: CaseTemplatePublic): CaseTemplate {
  return {
    id: String(dto.id),
    apiId: dto.id,
    slug: dto.name,
    name: dto.display_name || dto.name,
    builtin: false,
    author: dto.created_by,
    updated: compactDateTime(dto.updated_at ?? dto.created_at),
    description: dto.description,
    prefix: dto.title_prefix,
    assignee: '',
    sev: clamp(dto.severity, 1, 4, 2) as Severity,
    tlp: clamp(dto.tlp, 0, 3, 2) as Tlp,
    pap: clamp(dto.pap, 0, 3, 2) as Pap,
    tags: dto.tags,
    tasks: [...dto.tasks].sort((a, b) => a.order - b.order).map(toTemplateTask),
    customFields: [],
    summary: dto.summary,
  }
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || `template-${Date.now().toString(36)}`
  )
}

function taskPayload(task: CaseTemplateTask, order: number) {
  return {
    title: task.title.trim(),
    group: task.group.trim(),
    description: task.description.trim(),
    order,
  }
}

function createPayload(template: CaseTemplate) {
  const displayName = template.name.trim()
  return {
    name: slug(template.slug ?? template.id),
    display_name: displayName,
    title_prefix: template.prefix,
    description: template.description.trim(),
    severity: template.sev,
    tlp: template.tlp,
    pap: template.pap,
    summary: template.summary?.trim() || null,
    tasks: template.tasks
      .filter((task) => task.title.trim())
      .map((task, order) => taskPayload(task, order)),
  }
}

function updatePayload(template: CaseTemplate) {
  return {
    display_name: template.name.trim(),
    title_prefix: template.prefix,
    description: template.description.trim(),
    severity: template.sev,
    tlp: template.tlp,
    pap: template.pap,
    summary: template.summary?.trim() || null,
    tasks: template.tasks
      .filter((task) => task.title.trim())
      .map((task, order) => taskPayload(task, order)),
  }
}

async function setTemplateTags(id: string, tags: string[]) {
  await api.put(`case-templates/${id}/tags`, { json: { tags } })
}

export async function fetchCaseTemplates(
  filters: CaseTemplateListFilters = DEFAULT_CASE_TEMPLATE_FILTERS,
): Promise<CaseTemplatesResult> {
  const searchParams = {
    limit: String(filters.limit ?? DEFAULT_CASE_TEMPLATE_FILTERS.limit),
    skip: String(filters.skip ?? DEFAULT_CASE_TEMPLATE_FILTERS.skip),
  }
  const page = await api
    .get('case-templates/', { searchParams })
    .json<Page<CaseTemplatePublic>>()
  return { templates: page.items.map(toCaseTemplate), total: page.total }
}

export async function fetchCaseTemplate(id: string): Promise<CaseTemplate> {
  const dto = await api.get(`case-templates/${id}`).json<CaseTemplatePublic>()
  return toCaseTemplate(dto)
}

export async function createCaseTemplate(
  template: CaseTemplate,
): Promise<CaseTemplate> {
  const dto = await api
    .post('case-templates/', { json: createPayload(template) })
    .json<CaseTemplatePublic>()
  if (template.tags.length) {
    await setTemplateTags(String(dto.id), template.tags)
    return { ...toCaseTemplate(dto), tags: template.tags }
  }
  return toCaseTemplate(dto)
}

export async function updateCaseTemplate(
  template: CaseTemplate,
): Promise<CaseTemplate> {
  const id = String(template.apiId ?? template.id)
  const dto = await api
    .patch(`case-templates/${id}`, { json: updatePayload(template) })
    .json<CaseTemplatePublic>()
  await setTemplateTags(id, template.tags)
  return { ...toCaseTemplate(dto), tags: template.tags }
}

export async function duplicateCaseTemplate(
  template: CaseTemplate,
): Promise<CaseTemplate> {
  return createCaseTemplate({
    ...template,
    id: slug(`${template.slug ?? template.name}-copy`),
    apiId: undefined,
    slug: slug(`${template.slug ?? template.name}-copy`),
    name: `${template.name} (copy)`,
    builtin: false,
  })
}

export async function deleteCaseTemplate(id: string): Promise<void> {
  await api.delete(`case-templates/${id}`)
}

export async function exportCaseTemplate(
  id: string,
): Promise<CaseTemplateExport> {
  return api.get(`case-templates/${id}/export`).json<CaseTemplateExport>()
}

export async function importCaseTemplate(
  doc: CaseTemplateExport,
): Promise<CaseTemplate> {
  const dto = await api
    .post('case-templates/import', { json: doc })
    .json<CaseTemplatePublic>()
  return toCaseTemplate(dto)
}

export const caseTemplatesQueryOptions = (
  filters: CaseTemplateListFilters = DEFAULT_CASE_TEMPLATE_FILTERS,
) =>
  queryOptions({
    queryKey: caseTemplateKeys.list(filters),
    queryFn: () => fetchCaseTemplates(filters),
  })

export const caseTemplateQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseTemplateKeys.detail(id),
    queryFn: () => fetchCaseTemplate(id),
    enabled: id !== 'new',
  })
