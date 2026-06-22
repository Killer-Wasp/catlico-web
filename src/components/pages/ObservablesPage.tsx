import { TLP } from '#/lib/domain'
import classes from '#/components/Cases/CasesPage.module.css'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from '#/components/Observables/observables.types'
import {
  initialObservables,
  observableTypeLabels,
} from '#/components/Observables/observables'
import {
  observableEnrichmentsQueryOptions,
  observablesQueryOptions,
} from '#/components/Observables/observablesQueries'
import type {
  EnrichmentJob,
  EnrichmentOverview,
  EnrichmentVerdict,
  ReportTag,
} from '#/components/Observables/observablesQueries'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  Stack,
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
import { useQuery } from '@tanstack/react-query'
import { Play, X } from 'lucide-react'
import { useMemo, useState } from 'react'

const filterLblProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  fw: 500,
  c: 'dimmed',
  lts: '1px',
} as const

const TYPE_ORDER: ObservableType[] = [
  'domain',
  'url',
  'mail',
  'ip',
  'other',
  'hash',
  'file',
]

const UNIT_MIN: Record<string, number> = { m: 1, h: 60, d: 1440 }
const addedMinutes = (s: string) => {
  const relative = /^(\d+)\s*([mhd])$/.exec(s.trim())
  if (relative) return Number(relative[1]) * UNIT_MIN[relative[2]]

  const absolute = /^(\d{2}):(\d{2})$/.exec(s.trim())
  if (!absolute) return Number.POSITIVE_INFINITY
  return Number(absolute[1]) * 60 + Number(absolute[2])
}

const byAdded: SortingFn<Observable> = (a, b) =>
  addedMinutes(a.original.added) - addedMinutes(b.original.added)

const includesOneString: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

const includesAnySubstring: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((query) => cell.includes(query.toLowerCase()))
}

const includesAnyFlag: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const flags = row.getValue<ObservableFlag[]>(columnId)
  return filterValue.some((flag) => flags.includes(flag as ObservableFlag))
}

function flagLabel(flag: ObservableFlag) {
  return flag === 'ioc' ? 'IOC' : 'SIGHTED'
}

function TypePill({ type }: { type: ObservableType }) {
  return (
    <Badge
      variant="light"
      color="gray"
      radius="sm"
      tt="lowercase"
      ff="monospace"
      fz={11}
    >
      {type}
    </Badge>
  )
}

function TlpPill({ tlp }: { tlp: Observable['tlp'] }) {
  const label = TLP[tlp].toUpperCase()
  const color =
    tlp === 1 ? 'green' : tlp === 2 ? 'yellow' : tlp === 3 ? 'red' : 'gray'
  return (
    <Badge variant="light" color={color} radius="sm" ff="monospace" fz={11}>
      TLP:{label}
    </Badge>
  )
}

function AnalysisPill({ observable }: { observable: Observable }) {
  if (!observable.analysis) {
    return (
      <Text component="span" c="dimmed" ff="monospace" fz={13}>
        —
      </Text>
    )
  }

  return (
    <Badge variant="light" color="violet" radius="sm" ff="monospace" fz={11}>
      {observable.analysis.analyzer} {observable.analysis.verdict}
    </Badge>
  )
}

function addFlag(flags: ObservableFlag[], flag: ObservableFlag) {
  return flags.includes(flag) ? flags : [...flags, flag]
}

function toggleFlag(flags: ObservableFlag[], flag: ObservableFlag) {
  return flags.includes(flag)
    ? flags.filter((item) => item !== flag)
    : [...flags, flag]
}

export function ObservablesPage() {
  const { data: fetchedObservables = initialObservables } = useQuery(
    observablesQueryOptions(),
  )
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
      fetchedObservables.map((observable) =>
        flagOverrides[observable.id]
          ? { ...observable, flags: flagOverrides[observable.id] }
          : observable,
      ),
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

  const columns = useMemo<ColumnDef<Observable>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            size="xs"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all observables"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="xs"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select observable ${row.original.value}`}
          />
        ),
        enableColumnFilter: false,
        enableSorting: false,
        meta: { ta: 'center' },
      },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (row) => row.type,
        filterFn: includesOneString,
        enableSorting: false,
        cell: (info) => <TypePill type={info.getValue<ObservableType>()} />,
      },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (row) => row.value,
        filterFn: includesAnySubstring,
        enableSorting: true,
        cell: (info) => (
          <Text
            ff="monospace"
            fz={13}
            fw={600}
            style={{ whiteSpace: 'nowrap' }}
          >
            {info.getValue<string>()}
          </Text>
        ),
      },
      {
        id: 'flags',
        header: 'Flags',
        accessorFn: (row) => row.flags,
        filterFn: includesAnyFlag,
        enableSorting: false,
        meta: { visibleFrom: 'sm' },
        cell: (info) => {
          const flags = info.getValue<ObservableFlag[]>()
          return flags.length ? (
            <Group gap={6} wrap="nowrap">
              {flags.map((flag) => (
                <Text
                  key={flag}
                  component="span"
                  ff="monospace"
                  fz={11}
                  fw={700}
                  c={flag === 'ioc' ? 'dark.8' : 'yellow.7'}
                >
                  {flagLabel(flag)}
                </Text>
              ))}
            </Group>
          ) : (
            <Text component="span" c="dimmed" ff="monospace" fz={13}>
              —
            </Text>
          )
        },
      },
      {
        id: 'tlp',
        header: 'TLP',
        accessorFn: (row) => row.tlp,
        filterFn: includesOneString,
        enableSorting: false,
        cell: (info) => <TlpPill tlp={info.getValue<Observable['tlp']>()} />,
      },
      {
        id: 'source',
        header: 'Source',
        accessorFn: (row) => row.source,
        filterFn: includesOneString,
        enableSorting: false,
        meta: { visibleFrom: 'md' },
        cell: (info) => (
          <Badge variant="light" color="gray" radius="sm" ff="monospace">
            {info.getValue<string>()}
          </Badge>
        ),
      },
      {
        id: 'analysis',
        header: 'Analysis',
        enableColumnFilter: false,
        enableSorting: false,
        meta: { visibleFrom: 'md' },
        cell: ({ row }) => <AnalysisPill observable={row.original} />,
      },
      {
        id: 'added',
        header: 'Added',
        accessorFn: (row) => row.added,
        enableColumnFilter: false,
        enableSorting: true,
        sortingFn: byAdded,
        meta: { visibleFrom: 'sm' },
        cell: (info) => (
          <Text
            ff="monospace"
            fz={12}
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
        meta: { ta: 'right' },
        cell: ({ row }) => (
          <Button
            size="xs"
            variant="default"
            color="gray"
            leftSection={<Play size={12} fill="currentColor" />}
            onClick={() =>
              notifications.show({
                message: `Analyzer queued for ${row.original.value}`,
              })
            }
          >
            Analyze
          </Button>
        ),
      },
    ],
    [],
  )

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
  const pageCount = table.getPageCount()
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalFiltered)
  const rows = table.getRowModel().rows

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
          <Text component="span" {...filterLblProps}>
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

        <Table.ScrollContainer minWidth={1080}>
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
                    return (
                      <Table.Th
                        key={header.id}
                        {...headerProps}
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                        w={header.column.id === 'select' ? 40 : undefined}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </Table.Th>
                    )
                  })}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => {
                const isSelected = row.getIsSelected()
                return (
                  <Table.Tr
                    key={row.id}
                    bg={isSelected ? 'orange.0' : undefined}
                    tabIndex={0}
                    onClick={() => setActiveObservable(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter')
                        setActiveObservable(row.original)
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
                          onClick={
                            cell.column.id === 'select' ||
                            cell.column.id === 'actions'
                              ? (event) => event.stopPropagation()
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
                    No observables match the current filters.
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
          updateObservableFlags(observable.id, (flags) => toggleFlag(flags, 'ioc'))
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

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Group gap={20} align="flex-start" wrap="nowrap">
      <Text ff="monospace" fz={12} c="dimmed" w={120}>
        {label}
      </Text>
      <Text fz={13} fw={600}>
        {children}
      </Text>
    </Group>
  )
}

function DetailChip({
  children,
  color = 'gray',
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <Badge variant="light" color={color} radius="sm" ff="monospace" fz={11}>
      {children}
    </Badge>
  )
}

const VERDICT_RANK: Record<EnrichmentVerdict, number> = {
  info: 0,
  safe: 1,
  suspicious: 2,
  malicious: 3,
}

const VERDICT_COLOR: Record<EnrichmentVerdict, string> = {
  info: 'blue',
  safe: 'green',
  suspicious: 'yellow',
  malicious: 'red',
}

function topVerdict(jobs: EnrichmentJob[]): EnrichmentVerdict | null {
  let best: EnrichmentVerdict | null = null
  for (const job of jobs) {
    if (!job.verdict) continue
    if (best === null || VERDICT_RANK[job.verdict] > VERDICT_RANK[best]) {
      best = job.verdict
    }
  }
  return best
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function EnrichmentCard({
  job,
  tags,
}: {
  job: EnrichmentJob
  tags: ReportTag[]
}) {
  const failed = job.status !== 'success'
  const verdict = job.verdict ?? 'info'
  const color = failed ? 'gray' : VERDICT_COLOR[verdict]
  const stamp = clockTime(job.ended_at ?? job.queued_at)
  const meta = [
    `v${job.connector_version}`,
    stamp,
    job.from_cache ? 'cached' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Paper bg="gray.0" p="sm" radius="md" withBorder={false}>
      <Group justify="space-between" align="flex-start" mb={8}>
        <Group gap={8}>
          <DetailChip color={color}>
            {failed ? job.status.toUpperCase() : verdict.toUpperCase()}
          </DetailChip>
          <Text fw={700} fz={14}>
            {tags.length ? tags[0].namespace : job.connector_name}
          </Text>
        </Group>
        <Text ff="monospace" fz={11} c="dimmed">
          {meta}
        </Text>
      </Group>
      {failed && job.error ? (
        <Text fz={12} c="red.7">
          {job.error}
        </Text>
      ) : tags.length ? (
        <Group gap={6}>
          {tags.map((tag, i) => (
            <DetailChip key={i} color={VERDICT_COLOR[tag.level]}>
              {tag.namespace}:{tag.predicate}={tag.value}
            </DetailChip>
          ))}
        </Group>
      ) : (
        <Text fz={12} c="dimmed">
          No taxonomy reported.
        </Text>
      )}
    </Paper>
  )
}

function EnrichmentSection({ observableId }: { observableId: string }) {
  const { data, isPending, isError, isFetching, refetch } = useQuery(
    observableEnrichmentsQueryOptions(observableId),
  )
  const jobs = data?.jobs ?? []
  const tags = data?.tags ?? []
  const runAnalyzers = async () => {
    await refetch()
    notifications.show({
      color: 'blue',
      message: 'Analyzers queued and enrichment refreshed',
    })
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text {...headerProps}>Enrichment</Text>
        <Button
          size="xs"
          variant="default"
          color="gray"
          leftSection={<Play size={12} fill="currentColor" />}
          loading={isFetching}
          onClick={runAnalyzers}
        >
          Run analyzers
        </Button>
      </Group>

      {isPending ? (
        <Group gap="xs" py="sm">
          <Loader size="xs" />
          <Text fz={13} c="dimmed">
            Loading enrichment…
          </Text>
        </Group>
      ) : isError ? (
        <Text fz={13} c="red.7">
          Couldn’t load enrichment for this observable.
        </Text>
      ) : jobs.length === 0 ? (
        <Text fz={13} c="dimmed">
          No analyzers have run yet — run analyzers to enrich this observable.
        </Text>
      ) : (
        jobs.map((job) => (
          <EnrichmentCard
            key={job.id}
            job={job}
            tags={tags.filter(
              (tag) => tag.connector_name === job.connector_name,
            )}
          />
        ))
      )}
    </Stack>
  )
}

function VerdictBadge({ data }: { data: EnrichmentOverview | undefined }) {
  const verdict = data ? topVerdict(data.jobs) : null
  const label = verdict ? verdict.toUpperCase() : 'OBSERVED'
  const color = verdict ? VERDICT_COLOR[verdict] : 'gray'
  return (
    <Badge color={color} variant="light" mt="sm" radius="sm">
      {label}
    </Badge>
  )
}

function sourceLabel(source: string): string {
  if (source.startsWith('#')) return `Case ${source}`
  if (source.startsWith('AL-')) return `Alert ${source.slice(3)}`
  return source
}

export function ObservableDetailDrawer({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable | null
  onToggleIoc: (observable: Observable) => void
  onMarkSighted: (observable: Observable) => void
  onClose: () => void
}) {
  if (!observable) return null

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title="Observable detail"
      padding={0}
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
      styles={{
        content: { borderLeft: '4px solid var(--mantine-color-red-6)' },
        header: { display: 'none' },
        body: { height: '100%', padding: 0 },
      }}
    >
      <ObservableDetailContent
        observable={observable}
        onToggleIoc={onToggleIoc}
        onMarkSighted={onMarkSighted}
        onClose={onClose}
      />
    </Drawer>
  )
}

function ObservableDetailContent({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable
  onToggleIoc: (observable: Observable) => void
  onMarkSighted: (observable: Observable) => void
  onClose: () => void
}) {
  const { data } = useQuery(observableEnrichmentsQueryOptions(observable.id))
  const ioc = observable.flags.includes('ioc')
  const sighted = observable.flags.includes('sighted')

  return (
    <Stack h="100%" gap={0}>
      <Box p="lg" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text ff="monospace" fz={12} fw={700} c="dimmed" tt="uppercase">
              OBSERVABLE · {observable.type}
            </Text>
            <Text ff="monospace" fz={18} fw={700} mt={8}>
              {observable.value}
            </Text>
            <VerdictBadge data={data} />
          </Box>
          <ActionIcon
            variant="default"
            color="gray"
            aria-label="Close observable detail"
            onClick={onClose}
          >
            <X size={18} />
          </ActionIcon>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto' }}>
        <Stack gap="lg" p="lg">
          <Stack gap="xs">
            <Text {...headerProps}>Properties</Text>
            <DetailRow label="Type">{observable.type}</DetailRow>
            <DetailRow label="Value">{observable.value}</DetailRow>
            <DetailRow label="IOC">
              <Text component="span" c={ioc ? 'red.7' : 'dimmed'} fw={700}>
                {ioc ? 'yes' : 'no'}
              </Text>
            </DetailRow>
            <DetailRow label="Sighted">{sighted ? 'yes' : 'no'}</DetailRow>
            <DetailRow label="First seen">{observable.added}</DetailRow>
            <DetailRow label="Source">
              {sourceLabel(observable.source)}
            </DetailRow>
          </Stack>

          <EnrichmentSection observableId={observable.id} />
        </Stack>
      </Box>

      <Group
        p="lg"
        gap="sm"
        grow
        style={{ borderTop: '1px solid var(--line-soft)' }}
      >
        <Button variant="default" onClick={() => onToggleIoc(observable)}>
          Toggle IOC
        </Button>
        <Button
          variant="default"
          disabled={sighted}
          onClick={() => onMarkSighted(observable)}
        >
          Mark sighted
        </Button>
        <Button disabled>Export to MISP</Button>
      </Group>
    </Stack>
  )
}
