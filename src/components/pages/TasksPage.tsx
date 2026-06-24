import classes from '#/components/Cases/CasesPage.module.css'
import { getCaseRouteId } from '#/components/Cases/caseDetails'
import { Severity } from '#/components/Severity/Severity'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import {
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  advanceTaskStatus,
  avatarFor,
} from '#/components/Tasks/tasks'
import {
  DEFAULT_TASK_FILTERS,
  taskKeys,
  tasksQueryOptions,
  updateTaskStatus,
} from '#/components/Tasks/tasksQueries'
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Menu,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ColumnDef,
  FilterFn,
  SortingFn,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock3,
  EllipsisVertical,
  ExternalLink,
  Play,
} from 'lucide-react'
import { useMemo, useState } from 'react'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'inprogress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Mono, uppercase, dimmed column headers — applied via Mantine style props.
const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  fw: 500,
  c: 'dimmed',
  lts: '1px',
} as const

// Mono, uppercase, dimmed inline field labels (filter / sort / rows …).
const filterLblProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

// Match a single scalar cell value against the OR-list of selected values.
const includesOne: FilterFn<Task> = (row, columnId, filterValue: string[]) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

// Free-text fields (case number, title): cell contains any typed substring.
const includesAnySubstring: FilterFn<Task> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort by the numeric case id the task hangs off (e.g. "#1842").
const byCaseId: SortingFn<Task> = (a, b) =>
  Number(a.original.caseId.replace(/\D/g, '')) -
  Number(b.original.caseId.replace(/\D/g, ''))

const byDueDate: SortingFn<Task> = (a, b) => {
  const aTime = a.original.dueAt
    ? new Date(a.original.dueAt).getTime()
    : Infinity
  const bTime = b.original.dueAt
    ? new Date(b.original.dueAt).getTime()
    : Infinity
  return aTime - bTime
}

function Assignee({ name }: { name?: string }) {
  if (!name) {
    return (
      <Text component="span" fs="italic" c="dimmed">
        Unassigned
      </Text>
    )
  }
  const [initials, color] = avatarFor(name)
  return (
    <Group gap={10} wrap="nowrap">
      <Avatar color={color} size={28} radius="xl">
        {initials}
      </Avatar>
      <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
        {name}
      </Text>
    </Group>
  )
}

function DuePill({ task }: { task: Task }) {
  const urgent = task.urgent || task.overdue
  return (
    <Badge
      variant="light"
      color={task.overdue ? 'red' : urgent ? 'red' : 'gray'}
      radius="sm"
      size="sm"
      ff="monospace"
      leftSection={<Clock3 size={12} />}
      styles={{
        root: {
          textTransform: 'none',
          border: urgent ? '1px solid var(--mantine-color-red-3)' : undefined,
        },
      }}
    >
      {task.due}
    </Badge>
  )
}

function TaskStatusBadge({
  status,
  onAdvance,
}: {
  status: TaskStatus
  onAdvance: () => void
}) {
  return (
    <Badge
      component="button"
      type="button"
      variant="light"
      color={TASK_STATUS_COLOR[status]}
      radius="sm"
      size="sm"
      ff="monospace"
      onClick={(event) => {
        // Keep status advances on the badge — don't bubble to the row's
        // navigate-to-case handler.
        event.stopPropagation()
        onAdvance()
      }}
      styles={{
        root: {
          border: 0,
          cursor:
            status === 'waiting' || status === 'inprogress'
              ? 'pointer'
              : 'default',
        },
      }}
    >
      {TASK_STATUS_LABEL[status]}
    </Badge>
  )
}

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
    () => [
      {
        id: 'complete',
        header: '',
        enableColumnFilter: false,
        enableSorting: false,
        meta: { ta: 'center' },
        cell: ({ row }) => (
          <Checkbox
            size="sm"
            checked={row.original.status === 'completed'}
            disabled={row.original.status === 'cancelled'}
            onChange={() => completeMutation.mutate(row.original)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Complete ${row.original.title}`}
          />
        ),
      },
      {
        id: 'caseId',
        header: 'Case',
        accessorFn: (row) => row.caseId,
        filterFn: includesAnySubstring,
        sortingFn: byCaseId,
        cell: ({ row }) => (
          <Severity
            id={row.original.caseId}
            sev={row.original.caseSeverity === 'critical' ? 4 : 3}
          />
        ),
      },
      {
        id: 'title',
        header: 'Task',
        accessorFn: (row) => row.title,
        filterFn: includesAnySubstring,
        cell: ({ row }) => {
          const task = row.original
          return (
            <Box>
              <Group gap={8} wrap="wrap">
                <Text fw={700} size="sm">
                  {task.title}
                  {task.flagged ? (
                    <Text
                      component="span"
                      c="var(--sev-medium)"
                      ml={4}
                      aria-label="Flagged task"
                    >
                      |
                    </Text>
                  ) : null}
                </Text>
                <Badge
                  variant="default"
                  radius="sm"
                  size="sm"
                  ff="monospace"
                  tt="none"
                  fw={500}
                >
                  {task.kind}
                </Badge>
              </Group>
              <Text mt={3} ff="monospace" fz={11} c="dimmed">
                {task.description}
              </Text>
            </Box>
          )
        },
      },
      {
        id: 'kind',
        accessorFn: (row) => row.kind,
        filterFn: includesOne,
        // Filter-only column for the `kind:` token; rendered inline above.
        enableHiding: true,
        enableSorting: false,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        accessorFn: (row) => row.assignee ?? 'Unassigned',
        filterFn: includesOne,
        cell: ({ row }) => <Assignee name={row.original.assignee} />,
      },
      {
        id: 'due',
        header: 'Due',
        accessorFn: (row) => row.due,
        enableColumnFilter: false,
        sortingFn: byDueDate,
        cell: ({ row }) => <DuePill task={row.original} />,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        filterFn: includesOne,
        cell: ({ row }) => (
          <TaskStatusBadge
            status={row.original.status}
            onAdvance={() => advanceStatus(row.original)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableColumnFilter: false,
        enableSorting: false,
        meta: { ta: 'right' },
        cell: ({ row }) => {
          const task = row.original
          const canAdvance =
            task.status === 'waiting' || task.status === 'inprogress'
          const canComplete =
            task.status !== 'completed' && task.status !== 'cancelled'
          return (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  radius="md"
                  title="Task actions"
                  aria-label={`Task actions for ${task.title}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <EllipsisVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                <Menu.Item
                  leftSection={<ExternalLink size={14} />}
                  onClick={() => openTaskCase(task.caseId)}
                >
                  Open case
                </Menu.Item>
                <Menu.Item
                  leftSection={<Play size={14} />}
                  disabled={!canAdvance}
                  onClick={() => advanceStatus(task)}
                >
                  Advance status
                </Menu.Item>
                <Menu.Item
                  leftSection={<Check size={14} />}
                  disabled={!canComplete}
                  onClick={() => completeMutation.mutate(task)}
                >
                  Complete task
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )
        },
      },
    ],
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
  const rows = table.getRowModel().rows

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
          <Text component="span" {...filterLblProps}>
            filter
          </Text>
          <TokenSearch
            fields={filterFields}
            tokens={tokens}
            onChange={setTokens}
            placeholder="Filter tasks — pick a field, then a value"
          />
        </Group>

        <Table.ScrollContainer minWidth={1120}>
          <Table
            highlightOnHover
            horizontalSpacing="lg"
            verticalSpacing="md"
            borderColor="var(--line-soft)"
          >
            <Table.Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    const label = flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                    return (
                      <Table.Th
                        key={header.id}
                        {...headerProps}
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                        w={header.column.id === 'complete' ? 40 : undefined}
                      >
                        {canSort ? (
                          <Group
                            gap={4}
                            wrap="nowrap"
                            onClick={header.column.getToggleSortingHandler()}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {label}
                            {sorted === 'asc' ? (
                              <ChevronUp size={12} />
                            ) : sorted === 'desc' ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronsUpDown
                                size={12}
                                style={{ opacity: 0.4 }}
                              />
                            )}
                          </Group>
                        ) : (
                          label
                        )}
                      </Table.Th>
                    )
                  })}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {isPending ? (
                <Table.Tr>
                  <Table.Td
                    ta="center"
                    c="dimmed"
                    fz={13}
                    py={40}
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    <Group justify="center" gap="xs">
                      <Loader size="xs" />
                      <Text component="span" fz={13} c="dimmed">
                        Loading tasks…
                      </Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : isError ? (
                <Table.Tr>
                  <Table.Td
                    ta="center"
                    c="red.7"
                    fz={13}
                    py={40}
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    <Group justify="center" gap="xs">
                      <Text component="span" fz={13} c="red.7">
                        Couldn’t load tasks from the backend.
                      </Text>
                      <Button
                        size="xs"
                        variant="default"
                        loading={isFetching}
                        onClick={() => refetch()}
                      >
                        Retry
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows.map((row) => (
                  <Table.Tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => openTaskCase(row.original.caseId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter')
                        openTaskCase(row.original.caseId)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      return (
                        <Table.Td
                          key={cell.id}
                          ta={meta?.ta}
                          visibleFrom={meta?.visibleFrom}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                ))
              )}
              {!isPending && !isError && rows.length === 0 && (
                <Table.Tr>
                  <Table.Td
                    ta="center"
                    c="dimmed"
                    fz={13}
                    py={40}
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    No tasks match the current filters.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

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
              <Text component="span" {...filterLblProps}>
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
