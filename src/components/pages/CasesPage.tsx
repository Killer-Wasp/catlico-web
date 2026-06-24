import { getCaseRouteId } from '#/components/Cases/caseDetails'
import type { CaseStatus } from '#/lib/domain'
import type { Case } from '#/components/Cases/cases.types'
import { avatarFor } from '#/components/Cases/cases'
import {
  caseFacetsQueryOptions,
  casesQueryOptions,
} from '#/components/Cases/casesQueries'
import type { CaseListFilters, CaseSort } from '#/components/Cases/casesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { Severity } from '#/components/Severity/Severity'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Pagination,
  Paper,
  Progress,
  Select,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  OnChangeFn,
  RowData,
  SortingFn,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  ListChecks,
  Settings,
  UserPlus,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'duplicated', label: 'Duplicated' },
]

const SEV_OPTIONS = [
  { value: '4', label: 'Critical' },
  { value: '3', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '1', label: 'Low' },
]

// Table column id → the backend sort key it maps to. Only these columns are
// sortable server-side; the table's own filterFn/sortingFn are bypassed under
// the manual* flags below.
const SORT_FIELD: Record<string, CaseSort> = {
  id: 'id',
  created: 'created',
  updated: 'updated',
}

// Mono, uppercase, dimmed inline field labels (status / severity / rows …).
const filterLblProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

// Per-column responsive/alignment overrides carried on the column def so
// both the header and body cells stay in sync.
type CaseColumnMeta = {
  visibleFrom?: string
  ta?: 'left' | 'center' | 'right'
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> extends CaseColumnMeta {
    _t?: [TData, TValue]
  }
}

// MultiSelect filters hold an array of selected strings; an empty array
// means "no filter". `includesOne` matches a single scalar cell value,
// `includesAnyTag` matches when any selected tag is present on the row.
const includesOne: FilterFn<Case> = (row, columnId, filterValue: string[]) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

const includesAnyTag: FilterFn<Case> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const tags = row.getValue<string[]>(columnId)
  return filterValue.some((t) => tags.includes(t))
}

// Free-text fields (case number, title): match when the cell contains any of
// the typed substrings, case-insensitively.
const includesAnySubstring: FilterFn<Case> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort the "Case" column by the numeric case id (e.g. "#1842") rather
// than the severity its accessor carries for filtering.
const byCaseId: SortingFn<Case> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

// "created"/"updated" are relative strings ("8m" / "1h" / "6d"); convert to
// minutes so smaller = more recent and the columns sort chronologically.
const UNIT_MIN: Record<string, number> = { m: 1, h: 60, d: 1440 }
const ageMinutes = (s: string) => {
  const m = /^(\d+)\s*([mhd])$/.exec(s.trim())
  return m ? Number(m[1]) * UNIT_MIN[m[2]] : Number.POSITIVE_INFINITY
}
const byCreated: SortingFn<Case> = (a, b) =>
  ageMinutes(a.original.created) - ageMinutes(b.original.created)
const byUpdated: SortingFn<Case> = (a, b) =>
  ageMinutes(a.original.updated) - ageMinutes(b.original.updated)

function AssigneeAvatar({ name }: { name: string }) {
  const [initials, color] = avatarFor(name)
  return (
    <Avatar
      variant="filled"
      color={color}
      size={24}
      radius="xl"
      display="inline-flex"
    >
      {initials}
    </Avatar>
  )
}

export function CasesPage() {
  const navigate = useNavigate()

  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'id', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const pageSize = pagination.pageSize

  // Column filters + sort + page window → the backend query. Only fields that
  // carry a value are set, so the unfiltered first page deep-equals
  // DEFAULT_CASE_FILTERS and reads the route loader's warm cache.
  const filters = useMemo<CaseListFilters>(() => {
    const colVal = (id: string) =>
      columnFilters.find((f) => f.id === id)?.value as string[] | undefined
    const sort = sorting.at(0)
    const out: CaseListFilters = {
      sort: sort ? (SORT_FIELD[sort.id] ?? 'id') : 'id',
      order: sort ? (sort.desc ? 'desc' : 'asc') : 'desc',
      skip: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
    }
    const status = colVal('status')
    if (status?.length) out.status = status
    const severity = colVal('id')
    if (severity?.length) out.severity = severity.map(Number)
    const assignee = colVal('assignee')
    if (assignee?.length) out.assignee = assignee
    const tag = colVal('tags')
    if (tag?.length) out.tag = tag
    const title = colVal('title')
    if (title?.length) out.title = title
    const caseNo = colVal('caseNo')
    if (caseNo?.length) out.case = caseNo
    return out
  }, [columnFilters, sorting, pagination])

  const { data, isFetching } = useQuery(casesQueryOptions(filters))
  const cases = data?.cases ?? []
  const total = data?.total ?? 0
  const { data: facets } = useQuery(caseFacetsQueryOptions())

  // Filters or sort changing can invalidate the current page index, so snap
  // back to the first page whenever either does.
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const openCase = (id: string) => {
    navigate({
      to: '/cases/$caseId',
      params: { caseId: getCaseRouteId(id) },
    })
  }

  // Filter dropdown options come from the org-wide facets, not the current
  // page — so every assignee/tag stays selectable even when it's off-page.
  const assignees = useMemo(() => facets?.assignees ?? [], [facets])
  const assigneeOptions = useMemo(
    () => (facets?.unassigned ? [...assignees, 'Unassigned'] : assignees),
    [assignees, facets],
  )
  const tagOptions = useMemo(() => facets?.tags ?? [], [facets])

  const columns = useMemo<ColumnDef<Case>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            size="xs"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all cases"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="xs"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select case ${row.original.id}`}
          />
        ),
        enableColumnFilter: false,
        meta: { ta: 'center' } satisfies CaseColumnMeta,
      },
      {
        id: 'id',
        header: 'Case',
        accessorFn: (row) => row.sev,
        filterFn: includesOne,
        enableSorting: true,
        sortingFn: byCaseId,
        cell: (info) => (
          <Severity
            id={info.row.original.id}
            sev={info.getValue<Case['sev']>()}
          />
        ),
      },
      {
        id: 'title',
        header: 'Title',
        accessorFn: (row) => row.title,
        filterFn: includesAnySubstring,
        enableSorting: false,
        cell: (info) => {
          const tags = info.row.original.tags
          return (
            <Box>
              <Text
                fw={500}
                truncate
                maw={420}
                onClick={() => openCase(info.row.original.id)}
                style={{ cursor: 'pointer' }}
              >
                {info.getValue<string>()}
              </Text>
              <Group gap={6} mt={4} wrap="wrap">
                {tags.map((t) => (
                  <Tag key={t} label={t} />
                ))}
              </Group>
            </Box>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        filterFn: includesOne,
        enableSorting: false,
        cell: (info) => (
          <StatusBadge
            status={info.getValue<CaseStatus>()}
            label={info.row.original.statusName}
          />
        ),
      },
      {
        id: 'tasks',
        header: 'Tasks',
        accessorFn: (row) => ({ done: row.tasksDone, total: row.tasksTotal }),
        enableColumnFilter: false,
        enableSorting: false,
        meta: { visibleFrom: 'md' } satisfies CaseColumnMeta,
        cell: (info) => {
          const { done, total: taskTotal } = info.getValue<{
            done: number
            total: number
          }>()
          const pct = taskTotal ? (done / taskTotal) * 100 : 0
          return (
            <Group gap={8} wrap="nowrap" miw={110}>
              <Progress
                value={pct}
                size={5}
                radius="xl"
                color="var(--sev-low)"
                flex={1}
              />
              <Text
                ff="monospace"
                fz={10.5}
                c="var(--muted)"
                style={{ whiteSpace: 'nowrap' }}
              >
                {done}/{taskTotal}
              </Text>
            </Group>
          )
        },
      },
      {
        id: 'assignee',
        header: 'Assignee',
        accessorFn: (row) => row.assignee,
        filterFn: includesOne,
        enableSorting: false,
        meta: { visibleFrom: 'md', ta: 'center' } satisfies CaseColumnMeta,
        cell: (info) => <AssigneeAvatar name={info.getValue<string>()} />,
      },
      {
        id: 'tags',
        accessorFn: (row) => row.tags,
        filterFn: includesAnyTag,
        // Filter-only column; rendered inline in the title cell.
        enableHiding: true,
        enableSorting: false,
      },
      {
        id: 'caseNo',
        accessorFn: (row) => row.id,
        filterFn: includesAnySubstring,
        // Filter-only column for the `case:` token; never rendered.
        enableHiding: true,
        enableSorting: false,
      },
      {
        id: 'created',
        header: 'Created',
        accessorFn: (row) => row.created,
        enableColumnFilter: false,
        enableSorting: true,
        sortingFn: byCreated,
        meta: { visibleFrom: 'lg' } satisfies CaseColumnMeta,
        cell: (info) => (
          <Text
            ff="monospace"
            fz={11}
            c="dimmed"
            style={{ whiteSpace: 'nowrap' }}
          >
            {info.getValue<string>()}
          </Text>
        ),
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorFn: (row) => row.updated,
        enableColumnFilter: false,
        enableSorting: true,
        sortingFn: byUpdated,
        cell: (info) => (
          <Text
            ff="monospace"
            fz={11}
            c="dimmed"
            style={{ whiteSpace: 'nowrap' }}
          >
            {info.getValue<string>()}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableColumnFilter: false,
        enableSorting: false,
        meta: { ta: 'right' } satisfies CaseColumnMeta,
        cell: ({ row }) => (
          <Menu position="bottom-end" withArrow shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Case ${row.original.id} actions`}
              >
                <Settings size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<ExternalLink size={14} />}
                onClick={() => openCase(row.original.id)}
              >
                Open case
              </Menu.Item>
              <Menu.Sub>
                <Menu.Sub.Target>
                  <Menu.Sub.Item leftSection={<UserPlus size={14} />}>
                    Assign to
                  </Menu.Sub.Item>
                </Menu.Sub.Target>
                <Menu.Sub.Dropdown>
                  {assignees.map((name) => (
                    <Menu.Item
                      key={name}
                      onClick={() =>
                        notifications.show({
                          message: `${row.original.id} assigned to ${name}`,
                        })
                      }
                    >
                      {name}
                    </Menu.Item>
                  ))}
                </Menu.Sub.Dropdown>
              </Menu.Sub>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    // openCase closes over the stable `navigate`; `assignees` feeds the
    // row "Assign to" submenu.
    [assignees],
  )

  const table = useReactTable({
    data: cases,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility: { select: selectMode, tags: false, caseNo: false },
      pagination,
    },
    getRowId: (row) => row.id,
    // Filtering, sorting and pagination all run on the backend; the table just
    // renders the page the server returned. The column filter/sort state is
    // still tracked here so it can drive the tokens and the query.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    enableRowSelection: true,
    enableSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  // Token-search schema. Each field maps to a TanStack column; OR within a
  // field (array filter), AND across fields. `columnId` is internal wiring.
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
        key: 'severity',
        label: 'Severity',
        kind: 'enum',
        columnId: 'id',
        options: SEV_OPTIONS,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        kind: 'enum',
        columnId: 'assignee',
        options: toOpts(assigneeOptions),
      },
      {
        key: 'tag',
        label: 'Tag',
        kind: 'enum',
        columnId: 'tags',
        options: toOpts(tagOptions),
      },
      { key: 'case', label: 'Case', kind: 'text', columnId: 'caseNo' },
      { key: 'title', label: 'Title', kind: 'text', columnId: 'title' },
    ],
    [assigneeOptions, tagOptions],
  )

  const totalFiltered = total
  const { pageIndex } = pagination
  const pageCount = table.getPageCount()
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalFiltered)

  const hasFilters = columnFilters.length > 0
  const clearFilters = () => table.resetColumnFilters()

  const exitSelectMode = () => {
    setSelectMode(false)
    table.resetRowSelection()
  }

  // Derive tokens from the column filters (the single source of truth, so the
  // "Clear" button and tokens stay in sync), and push edits back to them.
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

  const rows = table.getRowModel().rows

  return (
    <Box className={classes.page}>
      <Paper radius="md" p={0} withBorder>
        <Group
          gap={12}
          px={18}
          py={14}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text fz={14} fw={600}>
            Open &amp; recent cases
          </Text>
          <Text
            component="span"
            ff="monospace"
            fz={11}
            c="var(--muted)"
            style={(theme) => ({
              background: `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`,
              border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
              padding: '1px 8px',
              borderRadius: 99,
            })}
          >
            {totalFiltered} cases
          </Text>
          <Group gap="xs" ml="auto">
            {hasFilters && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<X size={14} />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
            <Button
              size="xs"
              onClick={() => navigate({ to: '/cases/create' })}
              disabled={selectMode}
            >
              + New case
            </Button>
          </Group>
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
          <Button
            variant="default"
            size="xs"
            leftSection={!selectMode ? <ListChecks size={14} /> : undefined}
            onClick={() =>
              selectMode ? exitSelectMode() : setSelectMode(true)
            }
            aria-pressed={selectMode}
          >
            {selectMode
              ? `Cancel${
                  table.getSelectedRowModel().rows.length
                    ? ` (${table.getSelectedRowModel().rows.length})`
                    : ''
                }`
              : 'Select'}
          </Button>
        </Group>

        <Table.ScrollContainer
          minWidth={680}
          style={{
            opacity: isFetching ? 0.55 : 1,
            transition: 'opacity 120ms ease',
          }}
        >
          <Table
            highlightOnHover
            horizontalSpacing="lg"
            verticalSpacing="sm"
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
                        ff="monospace"
                        tt="uppercase"
                        fz={10}
                        fw={500}
                        c="dimmed"
                        lts="1px"
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                        w={header.column.id === 'select' ? 40 : undefined}
                      >
                        {canSort ? (
                          <Group
                            gap={4}
                            wrap="nowrap"
                            justify={
                              meta?.ta === 'center' ? 'center' : undefined
                            }
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
              {rows.map((row) => {
                const isSel = row.getIsSelected()
                return (
                  <Table.Tr
                    key={row.id}
                    bg={isSel ? 'orange.0' : undefined}
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      selectMode
                        ? row.toggleSelected()
                        : openCase(row.original.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        selectMode
                          ? row.toggleSelected()
                          : openCase(row.original.id)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      return (
                        <Table.Td
                          key={cell.id}
                          ta={meta?.ta}
                          visibleFrom={meta?.visibleFrom}
                          onClick={
                            cell.column.id === 'select' ||
                            cell.column.id === 'actions'
                              ? (e) => e.stopPropagation()
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                )
              })}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td
                    ta="center"
                    c="dimmed"
                    fz={13}
                    py={40}
                    px={18}
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    No cases match the current filters.
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
                onChange={(v) =>
                  setPagination({ pageIndex: 0, pageSize: Number(v ?? '10') })
                }
                allowDeselect={false}
              />
            </Group>
            <Pagination.Root
              total={pageCount}
              value={pageIndex + 1}
              onChange={(p) => table.setPageIndex(p - 1)}
              size="sm"
            >
              <Group gap={5} wrap="nowrap">
                <Pagination.First />
                <Pagination.Previous />
                <Text
                  component="span"
                  ff="monospace"
                  fz={12}
                  c="var(--muted)"
                  px={6}
                  style={{ whiteSpace: 'nowrap' }}
                >
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
