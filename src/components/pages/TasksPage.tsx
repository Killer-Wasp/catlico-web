import classes from '#/components/Cases/CasesPage.module.css'
import { Severity } from '#/components/Severity/Severity'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import {
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  advanceTaskStatus,
  avatarFor,
  initialTasks,
} from '#/components/Tasks/tasks'
import {
  Avatar,
  Badge,
  Box,
  Checkbox,
  Group,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
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
import { ChevronDown, ChevronUp, ChevronsUpDown, Clock3 } from 'lucide-react'
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
      onClick={onAdvance}
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
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'caseId', desc: false },
  ])

  const completeTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, status: 'completed' } : task,
      ),
    )
    notifications.show({ color: 'green', message: 'Task completed' })
  }

  const advanceStatus = (id: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task
        const nextStatus = advanceTaskStatus(task.status)
        if (nextStatus !== task.status) {
          notifications.show({
            color: nextStatus === 'completed' ? 'green' : 'yellow',
            message: `${task.title} moved to ${TASK_STATUS_LABEL[nextStatus]}`,
          })
        }
        return { ...task, status: nextStatus }
      }),
    )
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
            onChange={() => completeTask(row.original.id)}
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
        enableSorting: false,
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
        enableSorting: false,
        cell: ({ row }) => <Assignee name={row.original.assignee} />,
      },
      {
        id: 'due',
        header: 'Due',
        accessorFn: (row) => row.due,
        enableColumnFilter: false,
        enableSorting: false,
        cell: ({ row }) => <DuePill task={row.original} />,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        filterFn: includesOne,
        enableSorting: false,
        cell: ({ row }) => (
          <TaskStatusBadge
            status={row.original.status}
            onAdvance={() => advanceStatus(row.original.id)}
          />
        ),
      },
    ],
    [],
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
        new Set(initialTasks.map((t) => t.assignee ?? 'Unassigned')),
      ).sort(),
    [],
  )
  const kindOptions = useMemo(
    () => Array.from(new Set(initialTasks.map((t) => t.kind))).sort(),
    [],
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
      table.getColumn(f.columnId)?.setFilterValue(vals.length ? vals : undefined)
    }
  }

  const totalFiltered = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const pageCount = table.getPageCount()
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
          />
        </Group>

        <Table.ScrollContainer minWidth={1040}>
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
                              <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
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
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    return (
                      <Table.Td
                        key={cell.id}
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    )
                  })}
                </Table.Tr>
              ))}
              {rows.length === 0 && (
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
