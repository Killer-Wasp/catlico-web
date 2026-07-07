import { buildCaseColumns } from '#/components/pages/cases-list/caseColumns'
import { buildAlertColumns } from '#/components/pages/alerts/alertColumns'
import { buildTaskColumns } from '#/components/pages/tasks/taskColumns'
import { describe, expect, test, vi } from 'vitest'

describe('page table column order', () => {
  test('puts case status immediately after the case identifier column', () => {
    const columns = buildCaseColumns({
      openCase: vi.fn(),
      assignees: [],
    })

    expect(columns.map((column) => column.id)).toEqual([
      'select',
      'id',
      'status',
      'title',
      'tasks',
      'assignee',
      'tags',
      'caseNo',
      'created',
      'updated',
      'actions',
    ])
  })

  test('puts task status immediately after the case identifier column', () => {
    const columns = buildTaskColumns({
      onOpenCase: vi.fn(),
      onAdvance: vi.fn(),
      onComplete: vi.fn(),
    })

    expect(columns.map((column) => column.id)).toEqual([
      'select',
      'caseId',
      'status',
      'title',
      'kind',
      'assignee',
      'due',
      'actions',
    ])
  })

  test('marks utility columns as content-sized and title as flexible', () => {
    const caseColumns = buildCaseColumns({
      openCase: vi.fn(),
      assignees: [],
    })
    const taskColumns = buildTaskColumns({
      onOpenCase: vi.fn(),
      onAdvance: vi.fn(),
      onComplete: vi.fn(),
    })
    const alertColumns = buildAlertColumns({
      onRunAnalysis: vi.fn(),
      onIgnore: vi.fn(),
    })

    const caseTitle = caseColumns.find((column) => column.id === 'title')
    const taskTitle = taskColumns.find((column) => column.id === 'title')
    const alertTitle = alertColumns.find((column) => column.id === 'title')
    const caseId = caseColumns.find((column) => column.id === 'id')
    const taskCaseId = taskColumns.find((column) => column.id === 'caseId')
    const alertId = alertColumns.find((column) => column.id === 'id')

    expect(caseTitle?.meta?.grow).toBe(true)
    expect(taskTitle?.meta?.grow).toBe(true)
    expect(alertTitle?.meta?.grow).toBe(true)
    expect(caseId?.meta?.nowrap).toBe(true)
    expect(caseId?.meta?.compact).toBeUndefined()
    expect(
      caseColumns.find((column) => column.id === 'status')?.meta?.nowrap,
    ).toBe(true)
    expect(
      caseColumns.find((column) => column.id === 'status')?.meta?.compact,
    ).toBe(true)
    expect(
      caseColumns.find((column) => column.id === 'actions')?.meta?.nowrap,
    ).toBe(true)
    expect(taskCaseId?.meta?.nowrap).toBe(true)
    expect(taskCaseId?.meta?.compact).toBeUndefined()
    expect(
      taskColumns.find((column) => column.id === 'status')?.meta?.nowrap,
    ).toBe(true)
    expect(
      taskColumns.find((column) => column.id === 'status')?.meta?.compact,
    ).toBe(true)
    expect(
      taskColumns.find((column) => column.id === 'assignee')?.meta?.compact,
    ).toBe(true)
    expect(
      taskColumns.find((column) => column.id === 'due')?.meta?.compact,
    ).toBe(true)
    expect(
      taskColumns.find((column) => column.id === 'actions')?.meta?.nowrap,
    ).toBe(true)
    expect(alertId?.meta?.nowrap).toBe(true)
    expect(alertId?.meta?.compact).toBeUndefined()
    expect(
      alertColumns.find((column) => column.id === 'actions')?.meta?.nowrap,
    ).toBe(true)
  })
})
