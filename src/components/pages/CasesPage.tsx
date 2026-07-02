import { getCaseRouteId } from '#/components/Cases/caseDetails'
import type { Case } from '#/components/Cases/cases.types'
import {
  caseFacetsQueryOptions,
  casesQueryOptions,
} from '#/components/Cases/casesQueries'
import type { CaseListFilters } from '#/components/Cases/casesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import {
  Box,
  Button,
  Group,
  Pagination,
  Paper,
  Select,
  Text,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ListChecks, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SEVERITY_OPTIONS } from '#/lib/domain'
import { buildCaseColumns } from './cases-list/caseColumns'
import { CasesTable } from './cases-list/CasesTable'
import { SORT_FIELD, STATUS_OPTIONS } from './cases-list/constants'
import styles from './cases-list/styles.module.css'

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
    // openCase closes over the stable `navigate`; `assignees` feeds the
    // row "Assign to" submenu.
    () => buildCaseColumns({ openCase, assignees }),
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
        options: SEVERITY_OPTIONS,
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
          <Text component="span" className={styles.fieldLabel}>
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

        <CasesTable
          table={table}
          selectMode={selectMode}
          isFetching={isFetching}
          onOpenCase={openCase}
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
