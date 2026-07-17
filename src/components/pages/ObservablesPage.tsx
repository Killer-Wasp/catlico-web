import classes from '#/components/Cases/CasesPage.module.css'
import type {
  Observable,
  ObservableFlag,
} from '#/components/Observables/observables.types'
import { observableTypeLabels } from '#/components/Observables/observables'
import {
  observableKeys,
  observablesQueryOptions,
  updateObservableFlags,
} from '#/components/Observables/observablesQueries'
import { CreateObservableDialog } from '#/components/Observables/CreateObservableDialog'
import { PluginPickerDialog } from '#/components/Plugins/PluginPickerDialog'
import {
  analyzerRunTargets,
  dispatchAnalyzerRuns,
  notifyAnalyzerRuns,
} from '#/components/Plugins/runAnalyzers'
import type {
  ObservableListFilters,
  ObservableSort,
} from '#/components/Observables/observablesQueries'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import type { FilterClause } from '#/lib/filters'
import { Box, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ObservableDetailDrawer } from './observables/ObservableDetailDrawer'
import { buildObservableColumns } from './observables/observableColumns'
import { TYPE_ORDER } from './observables/constants'
import { addFlag, toggleFlag } from './observables/tableFns'

// Sortable columns whose id is a valid backend sort key.
const OBSERVABLE_SORTS = new Set<ObservableSort>(['value', 'added'])

export { ObservableDetailDrawer } from './observables/ObservableDetailDrawer'

export function ObservablesPage() {
  const [flagOverrides, setFlagOverrides] = useState<
    Partial<Record<string, ObservableFlag[]>>
  >({})
  const [rowSelection, setRowSelection] = useState({})
  const [selectMode, setSelectMode] = useState(false)
  const [activeObservable, setActiveObservable] = useState<Observable | null>(
    null,
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [tokens, setTokens] = useState<Token[]>([])
  const [addingObservable, setAddingObservable] = useState(false)
  const [runningAnalyzers, setRunningAnalyzers] = useState(false)
  const pageSize = pagination.pageSize
  const queryClient = useQueryClient()

  const filters = useMemo<ObservableListFilters>(() => {
    const sort = sorting.at(0)
    const sortKey =
      sort && OBSERVABLE_SORTS.has(sort.id as ObservableSort)
        ? (sort.id as ObservableSort)
        : ''
    const out: ObservableListFilters = {
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
    observablesQueryOptions(filters),
  )
  const fetchedObservables = data?.observables ?? []
  const total = data?.total ?? 0

  const onTokensChange = (next: Token[]) => {
    setTokens(next)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const observables = useMemo(
    () =>
      fetchedObservables.map((observable) => {
        const override = flagOverrides[observable.id]
        return override ? { ...observable, flags: override } : observable
      }),
    [fetchedObservables, flagOverrides],
  )

  const persistFlags = useMutation({
    mutationFn: ({
      id,
      flags,
    }: {
      id: string
      flags: ObservableFlag[]
    }) =>
      updateObservableFlags(id, {
        ioc: flags.includes('ioc'),
        sighted: flags.includes('sighted'),
      }),
    onSuccess: (_updated, variables) => {
      applyObservableFlags(variables.id, variables.flags)
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Unable to update observable flags',
      })
    },
  })

  const applyObservableFlags = (id: string, nextFlags: ObservableFlag[]) => {
    setFlagOverrides((current) => ({ ...current, [id]: nextFlags }))
    setActiveObservable((current) =>
      current?.id === id ? { ...current, flags: nextFlags } : current,
    )
  }

  const requestObservableFlags = (
    id: string,
    update: (flags: ObservableFlag[]) => ObservableFlag[],
  ) => {
    const currentFlags =
      flagOverrides[id] ??
      fetchedObservables.find((observable) => observable.id === id)?.flags ??
      []
    const nextFlags = update(currentFlags)
    persistFlags.mutate({ id, flags: nextFlags })
  }

  const columns = useMemo(() => buildObservableColumns(), [])

  const table = useReactTable({
    data: observables,
    columns,
    state: {
      rowSelection,
      sorting,
      pagination,
      columnVisibility: { select: selectMode },
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

  const filterFields = useMemo<TokenField[]>(
    () => [
      {
        key: 'type',
        label: 'Type',
        kind: 'enum',
        operators: ['eq'],
        options: TYPE_ORDER.map((type) => ({
          value: type,
          label: observableTypeLabels[type],
        })),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum',
        operators: ['eq'],
        options: [
          { value: '0', label: 'white' },
          { value: '1', label: 'green' },
          { value: '2', label: 'amber' },
          { value: '3', label: 'red' },
        ],
      },
      {
        key: 'flag',
        label: 'Flag',
        kind: 'enum',
        operators: ['eq'],
        options: [
          { value: 'ioc', label: 'IOC' },
          { value: 'sighted', label: 'Sighted' },
        ],
      },
      { key: 'value', label: 'Value', kind: 'text', operators: ['co', 'eq'] },
    ],
    [],
  )

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const runBulkAnalyzers = useMutation({
    mutationFn: ({
      pluginIds,
      force,
    }: {
      pluginIds: string[]
      force: boolean
    }) => {
      const observableIds = selectedRows.map((row) => row.original.id)
      return dispatchAnalyzerRuns(
        analyzerRunTargets(observableIds, pluginIds),
        force,
      )
    },
    onSuccess: (results) => {
      // Intentionally does NOT invalidate plugin-result queries: the dispatched
      // runs are asynchronous (nothing lands synchronously to refetch), so the
      // toast's link to /plugin-runs is the affordance. Don't "fix" this.
      notifyAnalyzerRuns(results)
    },
    // Close the picker once the fan-out settles (the dialog stays open with a
    // spinner while pending; the caller owns closing).
    onSettled: () => setRunningAnalyzers(false),
  })

  const toggleSelectMode = () => {
    setSelectMode((current) => {
      // Leaving select mode clears any pending selection.
      if (current) setRowSelection({})
      return !current
    })
  }

  return (
    <Box className={classes.page}>
      <TablePanel
        title="All observables"
        titleHeadingOrder={2}
        countNoun="observables"
        count={total}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter observables — type to search value, or pick a field"
        filterDefaultTextField="value"
        tokens={tokens}
        onTokensChange={onTokensChange}
        hasActiveFilters={tokens.length > 0}
        onClearFilters={() => onTokensChange([])}
        selectable
        selectMode={selectMode}
        onToggleSelectMode={toggleSelectMode}
        selectActions={
          <Button
            variant="default"
            size="xs"
            disabled={selectedCount === 0 || runBulkAnalyzers.isPending}
            onClick={() => setRunningAnalyzers(true)}
          >
            Run analyzers on selected
          </Button>
        }
        actions={
          selectMode ? undefined : (
            <Button size="xs" onClick={() => setAddingObservable(true)}>
              + Add observable
            </Button>
          )
        }
      >
        <DataTable
          table={table}
          minWidth={1080}
          emptyMessage="No observables match the current filters."
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => refetch()}
          loadingMessage="Loading observables…"
          errorMessage="Couldn’t load observables from the backend."
          onRowClick={(row) => setActiveObservable(row.original)}
        />
      </TablePanel>

      <ObservableDetailDrawer
        observable={activeObservable}
        onToggleIoc={(observable) =>
          requestObservableFlags(observable.id, (flags) =>
            toggleFlag(flags, 'ioc'),
          )
        }
        onMarkSighted={(observable) =>
          requestObservableFlags(observable.id, (flags) =>
            addFlag(flags, 'sighted'),
          )
        }
        onClose={() => setActiveObservable(null)}
      />

      <CreateObservableDialog
        opened={addingObservable}
        onClose={() => setAddingObservable(false)}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: observableKeys.all })
        }
      />

      <PluginPickerDialog
        opened={runningAnalyzers}
        onClose={() => setRunningAnalyzers(false)}
        isRunning={runBulkAnalyzers.isPending}
        contextLabel={`Run on ${selectedCount} selected observable${selectedCount === 1 ? '' : 's'}`}
        onRun={(selection) => runBulkAnalyzers.mutate(selection)}
      />
    </Box>
  )
}
