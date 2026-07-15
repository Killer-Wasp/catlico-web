import type { Pap, Severity, Tlp } from '#/lib/domain'

export type CustomFieldType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'url'

export type CaseTemplateTask = {
  title: string
  group: string
  description: string
  assignee: string
  dueInHours: number
  flagged: boolean
}

export type CaseTemplateCustomField = {
  key: string
  label: string
  type: CustomFieldType
  defaultValue: string
}

export type CaseTemplate = {
  id: string
  apiId?: number
  slug?: string
  name: string
  builtin: boolean
  // Raw `created_by` user id from the API; resolved to a display name in the UI.
  author: string
  updated: string
  description: string
  prefix: string
  assignee: string
  sev: Severity
  tlp: Tlp
  pap: Pap
  tags: string[]
  tasks: CaseTemplateTask[]
  customFields: CaseTemplateCustomField[]
  summary?: string | null
}

export type NewCaseCustomField = CaseTemplateCustomField & {
  mandatory: boolean
}

export type CaseTemplateFilter = 'all' | 'builtin' | 'custom'
