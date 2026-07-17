import classes from '#/components/Cases/CasesPage.module.css'
import { getCaseRouteId } from '#/components/Cases/caseDetails'
import { AssignMenu } from '#/components/Table/AssignMenu'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import { TASK_STATUS_LABEL, advanceTaskStatus } from '#/components/Tasks/tasks'
import {
  assignTask,
  taskFacetsQueryOptions,
  taskKeys,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import type { TaskListFilters, TaskSort } from '#/components/Tasks/tasksQueries'
import type { FilterClause } from '#/lib/filters'
import type { UserPublic } from '#/components/Users/usersQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import { Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OnChangeFn, ColumnDef, SortingState } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { buildTaskColumns } from './tasks/taskColumns'

// Task status filter options carry the backend enum value (Waiting/InProgress/…)
// so the server can match exactly.
const STATUS_FILTER_OPTIONS = [
  { value: 'Waiting', label: 'Waiting' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
]

// The queue defaults to unfinished tasks (Waiting | InProgress). These pills seed
// the filter bar on load; users can remove or clear them to see every task.
const DEFAULT_STATUS_TOKENS: Token[] = [
  { field: 'status', op: 'eq', value: 'Waiting', label: 'Waiting' },
  { field: 'status', op: 'eq', value: 'InProgress', label: 'In progress' },
]

// Sortable columns whose id is a valid backend sort key.
const TASK_SORTS = new Set<TaskSort>([
  'caseId',
  'title',
  'assignee',
  'due',
  'status',
])

export function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'caseId', desc: false },
  ])
  const [tokens, setTokens] = useState<Token[]>(DEFAULT_STATUS_TOKENS)
  const pageSize = pagination.pageSize

  // Tokens + sort + page window → the backend query.
  const filters = useMemo<TaskListFilters>(() => {
    const sort = sorting.at(0)
    const sortKey =
      sort && TASK_SORTS.has(sort.id as TaskSort)
        ? (sort.id as TaskSort)
        : 'caseId'
    const out: TaskListFilters = {
      sort: sortKey,
      order: sort ? (sort.desc ? 'desc' : 'asc') : 'asc',
      skip: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
    }
    const clauses: FilterClause[] = tokens.map((t) => ({
      key: t.field,
      op: t.op ?? 'eq',
      value: t.value,
    }))
    if (clauses.length) out.clauses = clauses
    return out
  }, [tokens, sorting, pagination])

  const { data, isPending, isError, refetch, isFetching } = useQuery(
    tasksQueryOptions(filters),
  )
  const tasks = data?.tasks ?? []
  const total = data?.total ?? 0
  const { data: facets } = useQuery(taskFacetsQueryOptions())

  const onTokensChange = (next: Token[]) => {
    setTokens(next)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

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
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    enableSorting: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  // Options come from org-wide facets so every value stays selectable even when
  // it's off the current page.
  const assigneeOptions = useMemo(() => {
    const xs = facets?.assignees ?? []
    return facets?.unassigned ? [...xs, 'Unassigned'] : xs
  }, [facets])
  const kindOptions = useMemo(() => facets?.kinds ?? [], [facets])

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo<TokenField[]>(
    () => [
      {
        key: 'status',
        label: 'Status',
        kind: 'enum',
        operators: ['eq'],
        options: STATUS_FILTER_OPTIONS,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        kind: 'enum',
        operators: ['eq'],
        options: toOpts(assigneeOptions),
      },
      {
        key: 'kind',
        label: 'Kind',
        kind: 'enum',
        operators: ['eq'],
        options: toOpts(kindOptions),
      },
      { key: 'case', label: 'Case', kind: 'text', operators: ['eq', 'co'] },
      { key: 'title', label: 'Title', kind: 'text', operators: ['co', 'eq'] },
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
        count={total}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter tasks — type to search title, or pick a field"
        filterDefaultTextField="title"
        tokens={tokens}
        onTokensChange={onTokensChange}
        hasActiveFilters={tokens.length > 0}
        onClearFilters={() => onTokensChange([])}
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
