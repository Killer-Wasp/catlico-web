import classes from '#/components/Cases/CasesPage.module.css'
import type {
  Observable,
  ObservableFlag,
} from '#/components/Observables/observables.types'
import { observableTypeLabels } from '#/components/Observables/observables'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import { Box, Button } from '@mantine/core'
import type { SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ObservableDetailDrawer } from './observables/ObservableDetailDrawer'
import { buildObservableColumns } from './observables/observableColumns'
import { TYPE_ORDER } from './observables/constants'
import { addFlag, toggleFlag } from './observables/tableFns'

export { ObservableDetailDrawer } from './observables/ObservableDetailDrawer'

export function ObservablesPage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    observablesQueryOptions(),
  )
  const fetchedObservables = data ?? []
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
  const observables = useMemo(
    () =>
      fetchedObservables.map((observable) => {
        const override = flagOverrides[observable.id]
        return override ? { ...observable, flags: override } : observable
      }),
    [fetchedObservables, flagOverrides],
  )

  const updateObservableFlags = (
    id: string,
    update: (flags: ObservableFlag[]) => ObservableFlag[],
  ) => {
    const currentFlags =
      flagOverrides[id] ??
      fetchedObservables.find((observable) => observable.id === id)?.flags ??
      []
    const nextFlags = update(currentFlags)
    setFlagOverrides((current) => ({ ...current, [id]: nextFlags }))
    setActiveObservable((current) =>
      current?.id === id ? { ...current, flags: nextFlags } : current,
    )
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

  const counts = useMemo(() => {
    return {
      all: observables.length,
      ioc: observables.filter((observable) => observable.flags.includes('ioc'))
        .length,
    }
  }, [observables])

  const sourceOptions = useMemo(
    () => Array.from(new Set(observables.map((o) => o.source))).sort(),
    [observables],
  )

  const toOpts = (values: string[]) =>
    values.map((value) => ({ value, label: value }))
  const filterFields = useMemo(
    () => [
      {
        key: 'type',
        label: 'Type',
        kind: 'enum' as const,
        columnId: 'type',
        options: TYPE_ORDER.map((type) => ({
          value: type,
          label: observableTypeLabels[type],
        })),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum' as const,
        columnId: 'tlp',
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
        kind: 'enum' as const,
        columnId: 'flags',
        options: [
          { value: 'ioc', label: 'IOC' },
          { value: 'sighted', label: 'Sighted' },
        ],
      },
      {
        key: 'source',
        label: 'Source',
        kind: 'enum' as const,
        columnId: 'source',
        options: toOpts(sourceOptions),
      },
      { key: 'value', label: 'Value', kind: 'text' as const, columnId: 'value' },
    ],
    [sourceOptions],
  )

  const selectedCount = table.getSelectedRowModel().rows.length

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
        countLabel={`${counts.all} observables · ${counts.ioc} IOC`}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter observables — pick a field, then a value"
        selectable
        selectMode={selectMode}
        onToggleSelectMode={toggleSelectMode}
        selectActions={
          <>
            <Button variant="default" size="xs" disabled={selectedCount === 0}>
              Run analyzers on selected
            </Button>
            <Button variant="default" size="xs" disabled={selectedCount === 0}>
              Export selected to MISP
            </Button>
          </>
        }
        actions={
          selectMode ? undefined : <Button size="xs">+ Add observable</Button>
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
          updateObservableFlags(observable.id, (flags) =>
            toggleFlag(flags, 'ioc'),
          )
        }
        onMarkSighted={(observable) =>
          updateObservableFlags(observable.id, (flags) =>
            addFlag(flags, 'sighted'),
          )
        }
        onClose={() => setActiveObservable(null)}
      />
    </Box>
  )
}
