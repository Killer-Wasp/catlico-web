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

export function ObservablesPage() {
  const [rowSelection, setRowSelection] = useState({})
  const [activeObservable, setActiveObservable] = useState<Observable | null>(
    null,
  )
  const [pageSize, setPageSize] = useState(6)
  const [sorting, setSorting] = useState<SortingState>([])

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
    data: initialObservables,
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
      all: initialObservables.length,
      ioc: initialObservables.filter((observable) =>
        observable.flags.includes('ioc'),
      ).length,
    }
  }, [])

  const sourceOptions = useMemo(
    () => Array.from(new Set(initialObservables.map((o) => o.source))).sort(),
    [],
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

function EnrichmentCard({
  verdict,
  title,
  meta,
  children,
}: {
  verdict: string
  title: string
  meta: string
  children: React.ReactNode
}) {
  const color =
    verdict === 'MALICIOUS'
      ? 'red'
      : verdict === 'SUSPICIOUS'
        ? 'yellow'
        : 'blue'
  return (
    <Paper bg="gray.0" p="sm" radius="md" withBorder={false}>
      <Group justify="space-between" align="flex-start" mb={8}>
        <Group gap={8}>
          <DetailChip color={color}>{verdict}</DetailChip>
          <Text fw={700} fz={14}>
            {title}
          </Text>
        </Group>
        <Text ff="monospace" fz={11} c="dimmed">
          {meta}
        </Text>
      </Group>
      {children}
    </Paper>
  )
}

function ObservableDetailDrawer({
  observable,
  onClose,
}: {
  observable: Observable | null
  onClose: () => void
}) {
  if (!observable) return null

  const ioc = observable.flags.includes('ioc')
  const sighted = observable.flags.includes('sighted')
  const firstSeen =
    observable.value === '203.0.113.47' ? '09:30' : observable.added
  const source =
    observable.value === '203.0.113.47'
      ? 'intel feed'
      : observable.source === 'feed'
        ? 'intel feed'
        : observable.source
  const verdict = observable.value === '203.0.113.47' ? 'MALICIOUS' : 'OBSERVED'

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
              <Badge color="red" variant="light" mt="sm" radius="sm">
                {verdict}
              </Badge>
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
              <DetailRow label="First seen">{firstSeen}</DetailRow>
              <DetailRow label="Source">{source}</DetailRow>
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between">
                <Text {...headerProps}>Enrichment</Text>
                <Button
                  size="xs"
                  variant="default"
                  color="gray"
                  leftSection={<Play size={12} fill="currentColor" />}
                >
                  Run analyzers
                </Button>
              </Group>

              <EnrichmentCard
                verdict="INFO"
                title="MaxMind GeoIP"
                meta="v4.0 · 10:31 · cached"
              >
                <Group gap={6}>
                  <DetailChip color="blue">GeoIP:country=AU</DetailChip>
                  <DetailChip color="blue">GeoIP:asn=AS7545 TPG</DetailChip>
                </Group>
              </EnrichmentCard>

              <EnrichmentCard
                verdict="MALICIOUS"
                title="AbuseIPDB"
                meta="v1.0 · 10:31"
              >
                <Stack gap="xs">
                  <Group gap={6}>
                    <DetailChip color="red">
                      AbuseIPDB:abuse-score=97%
                    </DetailChip>
                    <DetailChip color="yellow">AbuseIPDB:reports=41</DetailChip>
                  </Group>
                  <Text {...headerProps}>Extracted artifacts</Text>
                  <Group justify="space-between">
                    <Group gap={8}>
                      <TypePill type="domain" />
                      <Text ff="monospace" fw={700} fz={13}>
                        cdn-au-billing.net
                      </Text>
                    </Group>
                    <Button size="xs" variant="default" color="gray">
                      + add
                    </Button>
                  </Group>
                  <Text {...headerProps}>Case operations</Text>
                  <Stack gap={6}>
                    <Group gap={6}>
                      <Text ff="monospace" fz={12}>
                        ▸
                      </Text>
                      <Badge variant="light" color="gray">
                        add_tag
                      </Badge>
                      <Text ff="monospace" fz={12}>
                        tag=abuseipdb:malicious
                      </Text>
                    </Group>
                    <Group gap={6}>
                      <Text ff="monospace" fz={12}>
                        ▸
                      </Text>
                      <Badge variant="light" color="gray">
                        mark_as_ioc
                      </Badge>
                    </Group>
                  </Stack>
                </Stack>
              </EnrichmentCard>

              <EnrichmentCard
                verdict="SUSPICIOUS"
                title="GreyNoise"
                meta="v1.2 · 10:30"
              >
                <Group gap={6}>
                  <DetailChip color="red">
                    GreyNoise:classification=malicious
                  </DetailChip>
                  <DetailChip color="blue">GreyNoise:last-seen=2d</DetailChip>
                </Group>
              </EnrichmentCard>
            </Stack>

            <Stack gap="sm">
              <Text {...headerProps}>Seen in cases</Text>
              <Group justify="space-between">
                <Group gap={10}>
                  <Text ff="monospace" fz={12} c="dimmed">
                    #1842
                  </Text>
                  <Text fz={13} fw={600}>
                    OAuth consent grant — privileged account compromise
                  </Text>
                </Group>
                <Badge color="yellow" variant="light" radius="sm">
                  In progress
                </Badge>
              </Group>
            </Stack>
          </Stack>
        </Box>

        <Group
          p="lg"
          gap="sm"
          grow
          style={{ borderTop: '1px solid var(--line-soft)' }}
        >
          <Button variant="default">Toggle IOC</Button>
          <Button variant="default">Mark sighted</Button>
          <Button>Export to MISP</Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
