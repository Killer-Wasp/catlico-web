import classes from '#/components/Cases/CasesPage.module.css'
import { getCaseRouteId } from '#/components/Cases/caseDetails'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import { TASK_STATUS_LABEL, advanceTaskStatus } from '#/components/Tasks/tasks'
import {
  DEFAULT_TASK_FILTERS,
  taskKeys,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import { Box, Group, Pagination, Paper, Select, Text } from '@mantine/core'
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
import styles from './tasks/styles.module.css'
import { buildTaskColumns } from './tasks/taskColumns'
import { TasksTable } from './tasks/TasksTable'

export function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    tasksQueryOptions(DEFAULT_TASK_FILTERS),
  )
  const tasks = data?.tasks ?? []
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'caseId', desc: false },
  ])

  // Clicking a task row opens its parent case on the Tasks tab.
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
      columnVisibility: { kind: false },
      pagination: { pageIndex: 0, pageSize },
    },
    getRowId: (row) => row.id,
    enableSorting: true,
    onSortingChange: setSorting,
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
        kind: 'enum',
        columnId: 'status',
        options: STATUS_OPTIONS,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        kind: 'enum',
        columnId: 'assignee',
        options: toOpts(assigneeOptions),
      },
      {
        key: 'kind',
        label: 'Kind',
        kind: 'enum',
        columnId: 'kind',
        options: toOpts(kindOptions),
      },
      { key: 'case', label: 'Case', kind: 'text', columnId: 'caseId' },
      { key: 'title', label: 'Title', kind: 'text', columnId: 'title' },
    ],
    [assigneeOptions, kindOptions],
  )

  const columnFilters = table.getState().columnFilters
  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = []
    for (const f of filterFields) {
      const vals =
        (table.getColumn(f.columnId)?.getFilterValue() as
          | string[]
          | undefined) ?? []
      for (const v of vals) {
        const label =
          f.kind === 'enum'
            ? (f.options?.find((o) => o.value === v)?.label ?? v)
            : v
        out.push({ field: f.key, value: v, label })
      }
    }
    return out
  }, [table, columnFilters, filterFields])

  const setTokens = (next: Token[]) => {
    for (const f of filterFields) {
      const vals = next.filter((t) => t.field === f.key).map((t) => t.value)
      table
        .getColumn(f.columnId)
        ?.setFilterValue(vals.length ? vals : undefined)
    }
  }

  const totalFiltered = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const pageCount = Math.max(1, table.getPageCount())
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalFiltered)

  return (
    <Box className={classes.page}>
      <Paper radius="lg" p={0} withBorder>
        <Group
          gap={12}
          px={18}
          py={14}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text fz={15} fw={700}>
            Task queue
          </Text>
          <Text
            component="span"
            ff="monospace"
            fz={11}
            c="var(--muted)"
            style={(theme) => ({
              background: `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`,
              border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
              padding: '1px 10px',
              borderRadius: 99,
            })}
          >
            {totalFiltered} tasks
          </Text>
          <Text
            component="span"
            ff="monospace"
            fz={11}
            c="dimmed"
            ml="auto"
            visibleFrom="sm"
          >
            tick to complete - click status to advance
          </Text>
        </Group>

        <Group
          px="lg"
          py="sm"
          gap="md"
          wrap="nowrap"
          align="center"
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text component="span" className={styles.fieldLabel}>
            filter
          </Text>
          <TokenSearch
            fields={filterFields}
            tokens={tokens}
            onChange={setTokens}
            placeholder="Filter tasks — pick a field, then a value"
          />
        </Group>

        <TasksTable
          table={table}
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => refetch()}
          onOpenCase={openTaskCase}
        />

        <Group
          gap={12}
          px={18}
          py={12}
          wrap="wrap"
          style={{ borderTop: '1px solid var(--line-soft)' }}
        >
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {rangeStart}-{rangeEnd} of {totalFiltered}
          </Text>
          <Group gap="md" wrap="nowrap" ml="auto">
            <Group gap="xs" wrap="nowrap">
              <Text component="span" className={styles.fieldLabel}>
                rows
              </Text>
              <Select
                size="xs"
                w={76}
                data={['10', '25', '50']}
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v ?? '10'))}
                allowDeselect={false}
              />
            </Group>
            <Pagination.Root
              total={pageCount}
              value={pageIndex + 1}
              onChange={(p) => table.setPageIndex(p - 1)}
              size="sm"
            >
              <Group gap={6} wrap="nowrap">
                <Pagination.First />
                <Pagination.Previous />
                <Text component="span" ff="monospace" fz={13} px={6}>
                  {pageIndex + 1} / {pageCount}
                </Text>
                <Pagination.Next />
                <Pagination.Last />
              </Group>
            </Pagination.Root>
          </Group>
        </Group>
      </Paper>
    </Box>
  )
}
