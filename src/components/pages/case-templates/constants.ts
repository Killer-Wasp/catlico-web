import type { CaseTemplateFilter } from '#/components/Cases/caseTemplates.types'

export const filterTabs: { value: CaseTemplateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-In' },
  { value: 'custom', label: 'Custom' },
]
