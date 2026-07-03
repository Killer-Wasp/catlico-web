import type { Alert } from '#/components/Alerts/alerts.types'
import {
  alertKeys,
  alertsQueryOptions,
  mergeAlertsToCase,
  promoteAlertToCase,
} from '#/components/Alerts/alertsQueries'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { caseKeys } from '#/components/Cases/casesQueries'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
// Reuse the Cases page var scope so both tables share the SOC palette
// (severity / TLP / MITRE colours, soft borders) defined on `.page`.
import classes from '#/components/Cases/CasesPage.module.css'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import { Box, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from '@tanstack/react-router'
import type { SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { SEVERITY_OPTIONS, TLP_OPTIONS } from '#/lib/domain'
import { useMemo, useState } from 'react'
import { AlertDetailDrawer } from './alerts/AlertDetailDrawer'
import { buildAlertColumns } from './alerts/alertColumns'

export function AlertsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(alertsQueryOptions())
  const { data: caseTemplatesResult } = useQuery(caseTemplatesQueryOptions())
  const caseTemplates = caseTemplatesResult?.templates ?? []
  const [alerts, setAlerts] = useState<Alert[]>(data)
  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [alertComments, setAlertComments] = useState<Record<string, string[]>>({
    'AL-9119': [
      'Three grants inside 11 min is not user behaviour — recommend promoting with the phishing template.',
    ],
  })
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'id', desc: true },
  ])

  const activeAlert = alerts.find((alert) => alert.id === activeAlertId) ?? null

  const invalidatePromotedResources = () => {
    void queryClient.invalidateQueries({ queryKey: alertKeys.all })
    void queryClient.invalidateQueries({ queryKey: caseKeys.all })
  }

  const bulkPromoteMutation = useMutation({
    mutationFn: mergeAlertsToCase,
    onSuccess: (caseId, variables) => {
      invalidatePromotedResources()
      const promoted = new Set(variables.alertIds)
      setAlerts((prev) => prev.filter((alert) => !promoted.has(alert.id)))
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
      setAlerts((prev) =>
        prev.filter((alert) => alert.id !== variables.alertId),
      )
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
    setAlerts((prev) => prev.filter((a) => a.id !== id))
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
    enableRowSelection: true,
    enableSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  })

  const sourceOptions = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.src))).sort(),
    [alerts],
  )
  const tagOptions = useMemo(
    () => Array.from(new Set(alerts.flatMap((a) => a.tags))).sort(),
    [alerts],
  )

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo(
    () => [
      {
        key: 'severity',
        label: 'Severity',
        kind: 'enum' as const,
        columnId: 'id',
        options: SEVERITY_OPTIONS,
      },
      {
        key: 'source',
        label: 'Source',
        kind: 'enum' as const,
        columnId: 'source',
        options: toOpts(sourceOptions),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum' as const,
        columnId: 'tlp',
        options: TLP_OPTIONS,
      },
      {
        key: 'tag',
        label: 'Tag',
        kind: 'enum' as const,
        columnId: 'tags',
        options: toOpts(tagOptions),
      },
      { key: 'alert', label: 'Alert', kind: 'text' as const, columnId: 'alertNo' },
      { key: 'title', label: 'Title', kind: 'text' as const, columnId: 'title' },
    ],
    [sourceOptions, tagOptions],
  )

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
    const ids = new Set(selectedRows.map((r) => r.original.id))
    setAlerts((prev) => prev.filter((a) => !ids.has(a.id)))
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
        table={table}
        filterFields={filterFields}
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
          onRowClick={(row) =>
            selectMode
              ? row.toggleSelected()
              : openAlert(row.original.id)
          }
        />
      </TablePanel>
    </Box>
  )
}
