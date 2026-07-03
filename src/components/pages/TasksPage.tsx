import classes from '#/components/Cases/CasesPage.module.css'
import { getCaseRouteId } from '#/components/Cases/caseDetails'
import type { TokenField } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import { TASK_STATUS_LABEL, advanceTaskStatus } from '#/components/Tasks/tasks'
import {
  DEFAULT_TASK_FILTERS,
  taskKeys,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import { Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { STATUS_OPTIONS } from './tasks/constants'
import { buildTaskColumns } from './tasks/taskColumns'

export function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    tasksQueryOptions(DEFAULT_TASK_FILTERS),
  )
  const tasks = data?.tasks ?? []
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'caseId', desc: false },
  ])

  const openTaskCase = (caseId: string) => {
    navigate({
      to: '/cases/$caseId/$tab',
      params: { caseId: getCaseRouteId(caseId), tab: 'tasks' },
    })
  }

  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() })

  const statusMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => {
      if (task.apiId == null || task.caseApiId == null)
        throw new Error('Task is not linked to the API yet')
      return updateTaskStatus({
        caseId: task.caseApiId,
        taskId: task.apiId,
        status,
      })
    },
    onSuccess: (task) => {
      invalidateTasks()
      notifications.show({
        color: task.status === 'completed' ? 'green' : 'yellow',
        message: `${task.title} moved to ${TASK_STATUS_LABEL[task.status]}`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to update task',
      }),
  })

  const completeMutation = useMutation({
    mutationFn: async (task: Task) => {
      if (task.apiId == null || task.caseApiId == null)
        throw new Error('Task is not linked to the API yet')
      const ids = { caseId: task.caseApiId, taskId: task.apiId }
      if (task.status === 'waiting') {
        await updateTaskStatus({ ...ids, status: 'inprogress' })
      }
      return updateTaskStatus({ ...ids, status: 'completed' })
    },
    onSuccess: () => {
      invalidateTasks()
      notifications.show({ color: 'green', message: 'Task completed' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to complete task',
      }),
  })

  const advanceStatus = (task: Task) => {
    const nextStatus = advanceTaskStatus(task.status)
    if (nextStatus !== task.status) {
      statusMutation.mutate({ task, status: nextStatus })
    }
  }

  const columns = useMemo<ColumnDef<Task>[]>(
    () =>
      buildTaskColumns({
        onOpenCase: openTaskCase,
        onAdvance: advanceStatus,
        onComplete: (task) => completeMutation.mutate(task),
      }),
    [completeMutation, statusMutation],
  )

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      pagination,
      columnVisibility: { kind: false },
    },
    getRowId: (row) => row.id,
    enableSorting: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  })

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => task.assignee ?? 'Unassigned')),
      ).sort(),
    [tasks],
  )
  const kindOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.kind))).sort(),
    [tasks],
  )

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo<(TokenField & { columnId: string })[]>(
    () => [
      {
        key: 'status',
        label: 'Status',
        kind: 'enum' as const,
        columnId: 'status',
        options: STATUS_OPTIONS,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        kind: 'enum' as const,
        columnId: 'assignee',
        options: toOpts(assigneeOptions),
      },
      {
        key: 'kind',
        label: 'Kind',
        kind: 'enum' as const,
        columnId: 'kind',
        options: toOpts(kindOptions),
      },
      { key: 'case', label: 'Case', kind: 'text' as const, columnId: 'caseId' },
      { key: 'title', label: 'Title', kind: 'text' as const, columnId: 'title' },
    ],
    [assigneeOptions, kindOptions],
  )

  return (
    <Box className={classes.page}>
      <TablePanel
        title="Task queue"
        countNoun="tasks"
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter tasks — pick a field, then a value"
      >
        <DataTable
          table={table}
          minWidth={1120}
          verticalSpacing="md"
          emptyMessage="No tasks match the current filters."
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => refetch()}
          loadingMessage="Loading tasks…"
          errorMessage="Couldn’t load tasks from the backend."
          selectColumnId="complete"
          stopPropagationColumnIds={['complete', 'actions']}
          onRowClick={(row) => openTaskCase(row.original.caseId)}
        />
      </TablePanel>
    </Box>
  )
}
