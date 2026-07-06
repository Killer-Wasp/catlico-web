import type {
  CaseTemplate,
  CaseTemplateTask,
} from '#/components/Cases/caseTemplates.types'

export type DraftTask = CaseTemplateTask & {
  draftId: string
  dueAmount: string
  dueUnit: 'hours' | 'days'
}

export type DraftTemplate = Omit<CaseTemplate, 'tasks'> & {
  tasks: DraftTask[]
}

export function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

function dueFromHours(hours: number) {
  if (hours >= 24 && hours % 24 === 0) {
    return { dueAmount: String(hours / 24), dueUnit: 'days' as const }
  }

  return { dueAmount: String(hours), dueUnit: 'hours' as const }
}

function hoursFromDue(amount: string, unit: DraftTask['dueUnit']) {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return unit === 'days' ? Math.round(parsed * 24) : Math.round(parsed)
}

function createDraftTaskId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function toDraft(template: CaseTemplate): DraftTemplate {
  return {
    ...template,
    tags: [...template.tags],
    tasks: template.tasks.map((task) => ({
      ...task,
      draftId: createDraftTaskId(),
      ...dueFromHours(task.dueInHours),
    })),
    customFields: template.customFields.map((field) => ({ ...field })),
  }
}

export function newDraft(): DraftTemplate {
  return {
    id: '',
    slug: '',
    name: '',
    builtin: false,
    author: '',
    updated: 'just now',
    description: '',
    prefix: '',
    assignee: '',
    sev: 2,
    tlp: 2,
    pap: 2,
    tags: [],
    tasks: [],
    customFields: [],
  }
}

export function updateTask(
  tasks: DraftTask[],
  index: number,
  patch: Partial<DraftTask>,
) {
  return tasks.map((task, taskIndex) =>
    taskIndex === index ? { ...task, ...patch } : task,
  )
}

export function moveTask(tasks: DraftTask[], index: number, direction: -1 | 1) {
  const next = [...tasks]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function newDraftTask(): DraftTask {
  return {
    draftId: createDraftTaskId(),
    title: '',
    group: 'Triage',
    description: '',
    assignee: '',
    dueInHours: 1,
    flagged: false,
    dueAmount: '1',
    dueUnit: 'hours',
  }
}

export function toSavedTemplate(draft: DraftTemplate): CaseTemplate {
  const displayName = draft.name.trim()
  const slug = toSlug(draft.slug || draft.id || displayName)

  return {
    ...draft,
    id: draft.id || slug || `tpl-${Date.now().toString(36)}`,
    slug,
    name: displayName,
    description: draft.description.trim(),
    prefix: draft.prefix,
    assignee: draft.assignee,
    updated: 'just now',
    tasks: draft.tasks
      .filter((task) => task.title.trim())
      .map(({ draftId: _draftId, dueAmount, dueUnit, ...task }) => ({
        ...task,
        title: task.title.trim(),
        group: task.group.trim() || 'default',
        description: task.description.trim(),
        dueInHours: hoursFromDue(dueAmount, dueUnit),
      })),
    customFields: draft.customFields
      .filter((field) => field.label.trim())
      .map((field) => ({
        ...field,
        label: field.label.trim(),
        key:
          field.key ||
          field.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_|_$)/g, ''),
      })),
  }
}
