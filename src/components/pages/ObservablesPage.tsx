import classes from '#/components/Cases/CasesPage.module.css'
import type {
  Observable,
  ObservableFlag,
} from '#/components/Observables/observables.types'
import { observableTypeLabels } from '#/components/Observables/observables'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
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
import type { SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ObservableDetailDrawer } from './observables/ObservableDetailDrawer'
import { ObservablesTable } from './observables/ObservablesTable'
import { buildObservableColumns } from './observables/observableColumns'
import { TYPE_ORDER } from './observables/constants'
import styles from './observables/styles.module.css'
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
  const [activeObservable, setActiveObservable] = useState<Observable | null>(
    null,
  )
  const [pageSize, setPageSize] = useState(6)
  const [sorting, setSorting] = useState<SortingState>([])
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
      pagination: { pageIndex: 0, pageSize },
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
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
  const filterFields = useMemo<(TokenField & { columnId: string })[]>(
    () => [
      {
        key: 'type',
        label: 'Type',
        kind: 'enum',
        columnId: 'type',
        options: TYPE_ORDER.map((type) => ({
          value: type,
          label: observableTypeLabels[type],
        })),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum',
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
        kind: 'enum',
        columnId: 'flags',
        options: [
          { value: 'ioc', label: 'IOC' },
          { value: 'sighted', label: 'Sighted' },
        ],
      },
      {
        key: 'source',
        label: 'Source',
        kind: 'enum',
        columnId: 'source',
        options: toOpts(sourceOptions),
      },
      { key: 'value', label: 'Value', kind: 'text', columnId: 'value' },
    ],
    [sourceOptions],
  )

  const selectedCount = table.getSelectedRowModel().rows.length
  const totalFiltered = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const pageCount = Math.max(1, table.getPageCount())
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalFiltered)

  const columnFilters = table.getState().columnFilters
  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = []
    for (const field of filterFields) {
      const values =
        (table.getColumn(field.columnId)?.getFilterValue() as
          | string[]
          | undefined) ?? []
      for (const value of values) {
        const label =
          field.kind === 'enum'
            ? (field.options?.find((option) => option.value === value)?.label ??
              value)
            : value
        out.push({ field: field.key, value, label })
      }
    }
    return out
  }, [table, columnFilters, filterFields])

  const setTokens = (next: Token[]) => {
    for (const field of filterFields) {
      const values = next
        .filter((token) => token.field === field.key)
        .map((token) => token.value)
      table
        .getColumn(field.columnId)
        ?.setFilterValue(values.length ? values : undefined)
    }
  }
  const hasFilters = columnFilters.length > 0
  const clearFilters = () => table.resetColumnFilters()

  return (
    <Box className={classes.page}>
      <Group align="center" mb="lg" wrap="wrap">
        <Group gap={14} align="baseline">
          <Text
            component="h1"
            ff="'Space Grotesk', var(--mantine-font-family)"
            fz={30}
            fw={700}
            m={0}
            c="dark.9"
          >
            Observables
          </Text>
          <Text component="span" ff="monospace" fz={12} c="dimmed">
            Wed, 17 June 2026, 05:10 pm AEST
          </Text>
        </Group>
        <Group gap="sm" ml="auto">
          <Button variant="default" disabled={selectedCount === 0}>
            Run analyzers on selected
          </Button>
          <Button variant="default" disabled={selectedCount === 0}>
            Export selected to MISP
          </Button>
          <Button>+ Add observable</Button>
        </Group>
      </Group>

      <Paper radius="md" p={0} withBorder>
        <Group
          gap={12}
          px={18}
          py={14}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text component="h2" fz={14} fw={700} m={0}>
            All observables
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
            {counts.all} observables · {counts.ioc} IOC
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
            placeholder="Filter observables — pick a field, then a value"
          />
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
        </Group>

        <ObservablesTable
          table={table}
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => refetch()}
          onOpen={setActiveObservable}
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
                data={['6', '10', '25']}
                value={String(pageSize)}
                onChange={(value) => setPageSize(Number(value ?? '6'))}
                allowDeselect={false}
              />
            </Group>
            <Pagination.Root
              total={pageCount}
              value={pageIndex + 1}
              onChange={(page) => table.setPageIndex(page - 1)}
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
