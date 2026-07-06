import classes from '#/components/Cases/CasesPage.module.css'
import { getCaseRouteId } from '#/components/Cases/caseDetails'
import { AssignMenu } from '#/components/Table/AssignMenu'
import type { TokenField } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import { TASK_STATUS_LABEL, advanceTaskStatus } from '#/components/Tasks/tasks'
import {
  DEFAULT_TASK_FILTERS,
  assignTask,
  taskKeys,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import type { UserPublic } from '#/components/Users/usersQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
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
  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
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
      rowSelection,
      sorting,
      pagination,
      columnVisibility: { kind: false, select: selectMode },
    },
    getRowId: (row) => row.id,
    enableSorting: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
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

  const exitSelectMode = () => {
    setSelectMode(false)
    table.resetRowSelection()
  }

  const selectedTasks = table.getSelectedRowModel().rows
  const assignMutation = useMutation({
    mutationFn: async ({ rows, user }: { rows: Task[]; user: UserPublic }) => {
      await Promise.all(
        rows.map((task) => {
          if (task.apiId == null || task.caseApiId == null)
            throw new Error('Task is not linked to the API yet')
          return assignTask({
            caseId: task.caseApiId,
            taskId: task.apiId,
            assigneeId: user.id,
          })
        }),
      )
      return user
    },
    onSuccess: (user, { rows }) => {
      invalidateTasks()
      const name = userDisplayName(user)
      notifications.show({
        color: 'green',
        message:
          rows.length === 1
            ? `${rows[0].title} assigned to ${name}`
            : `${rows.length} tasks assigned to ${name}`,
      })
      exitSelectMode()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to assign tasks',
      }),
  })

  const assignSelectedTo = (user: UserPublic) =>
    assignMutation.mutate({
      rows: selectedTasks.map((row) => row.original),
      user,
    })

  return (
    <Box className={classes.page}>
      <TablePanel
        title="Task queue"
        countNoun="tasks"
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter tasks — pick a field, then a value"
        selectable
        selectMode={selectMode}
        onToggleSelectMode={() =>
          selectMode ? exitSelectMode() : setSelectMode(true)
        }
        actions={
          selectMode ? (
            <AssignMenu
              onAssign={assignSelectedTo}
              disabled={selectedTasks.length === 0}
              loading={assignMutation.isPending}
            />
          ) : undefined
        }
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
          stopPropagationColumnIds={['actions']}
          onRowClick={(row) =>
            selectMode
              ? row.toggleSelected()
              : openTaskCase(row.original.caseId)
          }
        />
      </TablePanel>
    </Box>
  )
}
