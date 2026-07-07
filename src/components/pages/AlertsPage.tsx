import {
  alertFacetsQueryOptions,
  alertKeys,
  alertsQueryOptions,
  mergeAlertsToCase,
  promoteAlertToCase,
} from '#/components/Alerts/alertsQueries'
import type {
  AlertListFilters,
  AlertSort,
} from '#/components/Alerts/alertsQueries'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { caseKeys } from '#/components/Cases/casesQueries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
// Reuse the Cases page var scope so both tables share the SOC palette
// (severity / TLP / MITRE colours, soft borders) defined on `.page`.
import classes from '#/components/Cases/CasesPage.module.css'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import type { FilterClause } from '#/lib/filters'
import { Box, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from '@tanstack/react-router'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { SEVERITY_OPTIONS, TLP_OPTIONS } from '#/lib/domain'
import { useMemo, useState } from 'react'
import { AlertDetailDrawer } from './alerts/AlertDetailDrawer'
import { buildAlertColumns } from './alerts/alertColumns'

// Sortable columns whose id is a valid backend sort key.
const ALERT_SORTS = new Set<AlertSort>(['id', 'age'])

export function AlertsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: caseTemplatesResult } = useQuery(caseTemplatesQueryOptions())
  const caseTemplates = caseTemplatesResult?.templates ?? []
  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [alertComments, setAlertComments] = useState<Record<string, string[]>>(
    {},
  )
  // Client-only "ignored"/promoted removals: alerts to hide from the current
  // view without a dedicated backend delete. Cleared on refetch is not needed —
  // promoted alerts stop matching, and ignore is a prototype cosmetic action.
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'id', desc: true },
  ])
  const [tokens, setTokens] = useState<Token[]>([])
  const pageSize = pagination.pageSize

  const filters = useMemo<AlertListFilters>(() => {
    const sort = sorting.at(0)
    const sortKey =
      sort && ALERT_SORTS.has(sort.id as AlertSort)
        ? (sort.id as AlertSort)
        : 'id'
    const out: AlertListFilters = {
      sort: sortKey,
      order: sort ? (sort.desc ? 'desc' : 'asc') : 'desc',
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
    alertsQueryOptions(filters),
  )
  const { data: facets } = useQuery(alertFacetsQueryOptions())
  const total = data?.total ?? 0
  const alerts = useMemo(
    () => (data?.alerts ?? []).filter((a) => !ignoredIds.has(a.id)),
    [data, ignoredIds],
  )
  const hideAlerts = (ids: Iterable<string>) =>
    setIgnoredIds((prev) => new Set([...prev, ...ids]))

  const onTokensChange = (next: Token[]) => {
    setTokens(next)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const activeAlert = alerts.find((alert) => alert.id === activeAlertId) ?? null

  const invalidatePromotedResources = () => {
    void queryClient.invalidateQueries({ queryKey: alertKeys.all })
    void queryClient.invalidateQueries({ queryKey: caseKeys.all })
  }

  const bulkPromoteMutation = useMutation({
    mutationFn: mergeAlertsToCase,
    onSuccess: (caseId, variables) => {
      invalidatePromotedResources()
      hideAlerts(variables.alertIds)
      notifications.show({
        color: 'teal',
        message: `Created case #${caseId} from ${variables.alertIds.length} alert${
          variables.alertIds.length > 1 ? 's' : ''
        }`,
      })
      exitSelectMode()
      void navigate({
        to: '/cases/$caseId/$tab',
        params: { caseId: String(caseId), tab: 'details' },
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to create case',
      }),
  })

  const promoteMutation = useMutation({
    mutationFn: promoteAlertToCase,
    onSuccess: (caseId, variables) => {
      invalidatePromotedResources()
      hideAlerts([variables.alertId])
      setActiveAlertId(null)
      notifications.show({
        color: 'orange',
        message: `${variables.alertId} promoted to case #${caseId}`,
      })
      void navigate({
        to: '/cases/$caseId/$tab',
        params: { caseId: String(caseId), tab: 'details' },
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to promote alert',
      }),
  })

  const openAlert = (id: string) => setActiveAlertId(id)

  const runAnalysis = (id: string) =>
    notifications.show({ color: 'blue', message: `Running analysis on ${id}…` })

  const ignoreAlert = (id: string) => {
    hideAlerts([id])
    setActiveAlertId((prev) => (prev === id ? null : prev))
    setRowSelection((prev) => {
      const next = { ...(prev as Record<string, boolean>) }
      delete next[id]
      return next
    })
    notifications.show({ message: `Alert ${id} marked as ignored` })
  }

  const columns = useMemo(
    () =>
      buildAlertColumns({ onRunAnalysis: runAnalysis, onIgnore: ignoreAlert }),
    [],
  )

  const table = useReactTable({
    data: alerts,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility: { select: selectMode, tags: false, alertNo: false },
      pagination,
    },
    getRowId: (row) => row.id,
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    enableRowSelection: true,
    enableSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  const sourceOptions = useMemo(() => facets?.sources ?? [], [facets])
  const tagKeys = useMemo(() => facets?.tagKeys ?? {}, [facets])

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo<TokenField[]>(() => {
    const core: TokenField[] = [
      {
        key: 'severity',
        label: 'Severity',
        kind: 'enum',
        operators: ['eq'],
        options: SEVERITY_OPTIONS,
      },
      {
        key: 'source',
        label: 'Source',
        kind: 'enum',
        operators: ['eq'],
        options: toOpts(sourceOptions),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum',
        operators: ['eq'],
        options: TLP_OPTIONS,
      },
      { key: 'alert', label: 'Alert', kind: 'text', operators: ['eq', 'co'] },
      { key: 'title', label: 'Title', kind: 'text', operators: ['eq', 'co'] },
    ]
    const tagFields: TokenField[] = Object.entries(tagKeys).map(
      ([key, values]): TokenField => ({
        key: `tag:${key}`,
        label: key.includes(':') ? key : key.toUpperCase(),
        kind: 'enum',
        operators: ['eq'],
        options: toOpts(values),
      }),
    )
    return [...core, ...tagFields]
  }, [sourceOptions, tagKeys])

  const exitSelectMode = () => {
    setSelectMode(false)
    table.resetRowSelection()
  }

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const createCase = () => {
    if (selectedCount < 1) {
      notifications.show({
        color: 'red',
        message: 'Select alerts first (checkboxes on the left)',
      })
      return
    }
    bulkPromoteMutation.mutate({
      alertIds: selectedRows.map((row) => row.original.id),
      caseTemplateId: caseTemplates.length > 0 ? caseTemplates[0].apiId : null,
    })
  }

  const addAlertComment = (id: string, note: string) => {
    const trimmed = note.trim()
    if (!trimmed) return
    setAlertComments((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), trimmed],
    }))
  }

  const ignoreSelected = () => {
    if (selectedCount < 1) {
      notifications.show({
        color: 'red',
        message: 'Select alerts first (checkboxes on the left)',
      })
      return
    }
    hideAlerts(selectedRows.map((r) => r.original.id))
    notifications.show({
      message: `${selectedCount} alert${selectedCount > 1 ? 's' : ''} marked as ignored`,
    })
    exitSelectMode()
  }

  return (
    <Box className={classes.page}>
      <AlertDetailDrawer
        alert={activeAlert}
        caseTemplates={caseTemplates}
        comments={activeAlert ? (alertComments[activeAlert.id] ?? []) : []}
        onClose={() => setActiveAlertId(null)}
        onAddComment={addAlertComment}
        onIgnore={ignoreAlert}
        onRunAnalysis={runAnalysis}
        onPromote={(alertId, nextTemplateId) => {
          const selectedTemplate = caseTemplates.find(
            (template) => template.id === nextTemplateId,
          )
          promoteMutation.mutate({
            alertId,
            caseTemplateId: selectedTemplate?.apiId ?? null,
          })
        }}
        promotionPending={promoteMutation.isPending}
      />
      <TablePanel
        title="All alerts"
        countNoun="alerts"
        count={total}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter alerts — pick a field, then a value"
        tokens={tokens}
        onTokensChange={onTokensChange}
        hasActiveFilters={tokens.length > 0}
        onClearFilters={() => onTokensChange([])}
        selectable
        selectMode={selectMode}
        onToggleSelectMode={() =>
          selectMode ? exitSelectMode() : setSelectMode(true)
        }
        selectActions={
          <>
            <Button
              size="xs"
              color="green"
              onClick={createCase}
              disabled={selectedCount < 1}
              loading={bulkPromoteMutation.isPending}
            >
              {selectedCount ? `Create case (${selectedCount})` : 'Create case'}
            </Button>
            <Button
              size="xs"
              variant="default"
              onClick={ignoreSelected}
              disabled={selectedCount < 1}
            >
              {selectedCount
                ? `Mark ignored (${selectedCount})`
                : 'Mark ignored'}
            </Button>
          </>
        }
      >
        <DataTable
          table={table}
          minWidth={820}
          emptyMessage="No alerts match the current filters."
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => refetch()}
          loadingMessage="Loading alerts…"
          errorMessage="Couldn’t load alerts from the backend."
          onRowClick={(row) =>
            selectMode ? row.toggleSelected() : openAlert(row.original.id)
          }
        />
      </TablePanel>
    </Box>
  )
}
