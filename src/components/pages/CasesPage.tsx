import { getCaseRouteId } from '#/components/Cases/caseDetails'
import type { Case } from '#/components/Cases/cases.types'
import {
  caseFacetsQueryOptions,
  caseKeys,
  casesQueryOptions,
  updateCaseAssignee,
} from '#/components/Cases/casesQueries'
import type { CaseListFilters } from '#/components/Cases/casesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { AssignMenu } from '#/components/Table/AssignMenu'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { UserPublic } from '#/components/Users/usersQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
import { Button, Box } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { SEVERITY_OPTIONS } from '#/lib/domain'
import { buildCaseColumns } from './cases-list/caseColumns'
import { SORT_FIELD, STATUS_OPTIONS } from './cases-list/constants'

export function CasesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        kind: 'enum' as const,
        columnId: 'status',
        options: STATUS_OPTIONS,
      },
      {
        key: 'severity',
        label: 'Severity',
        kind: 'enum' as const,
        columnId: 'id',
        options: SEVERITY_OPTIONS,
      },
      {
        key: 'assignee',
        label: 'Assignee',
        kind: 'enum' as const,
        columnId: 'assignee',
        options: toOpts(assigneeOptions),
      },
      {
        key: 'tag',
        label: 'Tag',
        kind: 'enum' as const,
        columnId: 'tags',
        options: toOpts(tagOptions),
      },
      { key: 'case', label: 'Case', kind: 'text' as const, columnId: 'caseNo' },
      { key: 'title', label: 'Title', kind: 'text' as const, columnId: 'title' },
    ],
    [assigneeOptions, tagOptions],
  )

  const exitSelectMode = () => {
    setSelectMode(false)
    table.resetRowSelection()
  }

  const selectedCases = table.getSelectedRowModel().rows
  const assignMutation = useMutation({
    mutationFn: async ({ ids, user }: { ids: string[]; user: UserPublic }) => {
      await Promise.all(ids.map((id) => updateCaseAssignee(id, user.id)))
      return user
    },
    onSuccess: (user, { ids }) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      const name = userDisplayName(user)
      notifications.show({
        message:
          ids.length === 1
            ? `${ids[0]} assigned to ${name}`
            : `${ids.length} cases assigned to ${name}`,
      })
      exitSelectMode()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to assign cases',
      }),
  })

  const assignSelectedTo = (user: UserPublic) =>
    assignMutation.mutate({
      ids: selectedCases.map((row) => row.original.id),
      user,
    })

  return (
    <Box className={classes.page}>
      <TablePanel
        title="Open & recent cases"
        countNoun="cases"
        count={total}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter cases — pick a field, then a value"
        selectable
        selectMode={selectMode}
        onToggleSelectMode={() =>
          selectMode ? exitSelectMode() : setSelectMode(true)
        }
        actions={
          selectMode ? (
            <AssignMenu
              onAssign={assignSelectedTo}
              disabled={selectedCases.length === 0}
              loading={assignMutation.isPending}
            />
          ) : (
            <Button size="xs" onClick={() => navigate({ to: '/cases/create' })}>
              + New case
            </Button>
          )
        }
      >
        <DataTable
          table={table}
          minWidth={680}
          emptyMessage="No cases match the current filters."
          isFetching={isFetching}
          onRowClick={(row) =>
            selectMode ? row.toggleSelected() : openCase(row.original.id)
          }
        />
      </TablePanel>
    </Box>
  )
}
