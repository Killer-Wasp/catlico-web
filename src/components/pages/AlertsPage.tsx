import type { Alert } from '#/components/Alerts/alerts.types'
import { SEV, TLP } from '#/lib/domain'
import { fmtAge, srcColor } from '#/components/Alerts/alerts'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import { useSuspenseQuery } from '@tanstack/react-query'
import { caseTemplatesList } from '#/components/Cases/caseTemplates'
// Reuse the Cases page var scope so both tables share the SOC palette
// (severity / TLP / MITRE colours, soft borders) defined on `.page`.
import classes from '#/components/Cases/CasesPage.module.css'
import { Severity } from '#/components/Severity/Severity'
import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  ColorSwatch,
  Divider,
  Drawer,
  Group,
  Menu,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  VisuallyHidden,
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
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  EyeOff,
  ListChecks,
  Play,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

const SEV_OPTIONS = [
  { value: '4', label: 'Critical' },
  { value: '3', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '1', label: 'Low' },
]

const TLP_OPTIONS = [
  { value: '3', label: 'RED' },
  { value: '2', label: 'AMBER' },
  { value: '1', label: 'GREEN' },
  { value: '0', label: 'WHITE' },
]

const TLP_COLOR: Record<string, string> = {
  red: 'red',
  amber: 'yellow',
  green: 'green',
  white: 'gray',
}

// Mono, uppercase, dimmed column headers — applied via Mantine style props.
const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  fw: 500,
  c: 'dimmed',
  lts: '1px',
} as const

// Mono, uppercase, dimmed inline field labels (filter / sort / rows …).
const filterLblProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

// Match a single scalar cell value against the OR-list of selected values.
const includesOne: FilterFn<Alert> = (row, columnId, filterValue: string[]) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

const includesAnyTag: FilterFn<Alert> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const tags = row.getValue<string[]>(columnId)
  return filterValue.some((t) => tags.includes(t))
}

// Free-text fields (alert number, title): cell contains any typed substring.
const includesAnySubstring: FilterFn<Alert> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort the "Alert" column by the numeric id (e.g. "AL-9123").
const byAlertId: SortingFn<Alert> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

// Sort "Age" chronologically by the underlying minutes.
const byAge: SortingFn<Alert> = (a, b) => a.original.ageMin - b.original.ageMin

export function AlertsPage() {
  // Reads the loader-warmed cache (see the route's `ensureQueryData`). Local
  // edits still live in `useState`, seeded from the fetched data.
  const { data } = useSuspenseQuery(alertsQueryOptions())
  const [alerts, setAlerts] = useState<Alert[]>(data)
  const [selectMode, setSelectMode] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [alertComments, setAlertComments] = useState<Record<string, string[]>>({
    'AL-9119': [
      'Three grants inside 11 min is not user behaviour — recommend promoting with the phishing template.',
    ],
  })
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'id', desc: true },
  ])

  const activeAlert = alerts.find((alert) => alert.id === activeAlertId) ?? null

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

  const columns = useMemo<ColumnDef<Alert>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            size="xs"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all alerts"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="xs"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select alert ${row.original.id}`}
          />
        ),
        enableColumnFilter: false,
        enableSorting: false,
        meta: { ta: 'center' },
      },
      {
        id: 'id',
        header: 'Alert',
        accessorFn: (row) => row.sev,
        filterFn: includesOne,
        sortingFn: byAlertId,
        cell: ({ row }) => <Severity id={row.original.id} sev={row.original.sev} />,
      },
      {
        id: 'title',
        header: 'Title',
        accessorFn: (row) => row.title,
        filterFn: includesAnySubstring,
        enableSorting: false,
        cell: ({ row }) => (
          <Box>
            <Text fw={500} truncate maw={420}>
              {row.original.title}
            </Text>
            <Group gap={6} mt={4} wrap="wrap">
              {row.original.tags.map((t) => (
                <Tag key={t} label={t} />
              ))}
            </Group>
          </Box>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        accessorFn: (row) => row.src,
        filterFn: includesOne,
        enableSorting: false,
        cell: ({ row }) => (
          <Group gap={8} wrap="nowrap">
            <ColorSwatch
              size={8}
              radius="sm"
              color={srcColor(row.original.src)}
              withShadow={false}
            />
            <Text size="sm" c="dimmed">
              {row.original.src}
            </Text>
          </Group>
        ),
      },
      {
        id: 'tlp',
        header: 'TLP',
        accessorFn: (row) => row.tlp,
        filterFn: includesOne,
        enableSorting: false,
        cell: ({ row }) => {
          const tlpName = TLP[row.original.tlp]
          return (
            <Badge
              color={TLP_COLOR[tlpName]}
              variant="light"
              radius="sm"
              size="sm"
              ff="monospace"
            >
              TLP:{tlpName.toUpperCase()}
            </Badge>
          )
        },
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
        id: 'alertNo',
        accessorFn: (row) => row.id,
        filterFn: includesAnySubstring,
        // Filter-only column for the `alert:` token; never rendered.
        enableHiding: true,
        enableSorting: false,
      },
      {
        id: 'age',
        header: 'Age',
        accessorFn: (row) => row.ageMin,
        enableColumnFilter: false,
        sortingFn: byAge,
        cell: ({ row }) => (
          <Text
            ff="monospace"
            fz={11}
            c={row.original.breach ? 'var(--sev-critical)' : 'dimmed'}
            style={{ whiteSpace: 'nowrap' }}
          >
            {fmtAge(row.original.ageMin)}
            {row.original.breach ? ' ⚠' : ''}
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
          <Menu position="bottom-end" withArrow shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Alert ${row.original.id} actions`}
              >
                <Settings size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Sparkles size={14} />}
                onClick={() => runAnalysis(row.original.id)}
              >
                Run analysis
              </Menu.Item>
              <Menu.Item
                leftSection={<EyeOff size={14} />}
                onClick={() => ignoreAlert(row.original.id)}
              >
                Ignore
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: alerts,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility: { select: selectMode, tags: false, alertNo: false },
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

  const sourceOptions = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.src))).sort(),
    [alerts],
  )
  const tagOptions = useMemo(
    () => Array.from(new Set(alerts.flatMap((a) => a.tags))).sort(),
    [alerts],
  )

  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const filterFields = useMemo<(TokenField & { columnId: string })[]>(
    () => [
      {
        key: 'severity',
        label: 'Severity',
        kind: 'enum',
        columnId: 'id',
        options: SEV_OPTIONS,
      },
      {
        key: 'source',
        label: 'Source',
        kind: 'enum',
        columnId: 'source',
        options: toOpts(sourceOptions),
      },
      {
        key: 'tlp',
        label: 'TLP',
        kind: 'enum',
        columnId: 'tlp',
        options: TLP_OPTIONS,
      },
      {
        key: 'tag',
        label: 'Tag',
        kind: 'enum',
        columnId: 'tags',
        options: toOpts(tagOptions),
      },
      { key: 'alert', label: 'Alert', kind: 'text', columnId: 'alertNo' },
      { key: 'title', label: 'Title', kind: 'text', columnId: 'title' },
    ],
    [sourceOptions, tagOptions],
  )

  const columnFilters = table.getState().columnFilters
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
      table.getColumn(f.columnId)?.setFilterValue(vals.length ? vals : undefined)
    }
  }

  const hasFilters = columnFilters.length > 0
  const clearFilters = () => table.resetColumnFilters()

  const exitSelectMode = () => {
    setSelectMode(false)
    table.resetRowSelection()
  }

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const createCase = () => {
    notifications.show({
      color: 'teal',
      message: `Case created from ${selectedCount} alert${selectedCount > 1 ? 's' : ''}`,
    })
    exitSelectMode()
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

  const totalFiltered = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const pageCount = table.getPageCount()
  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalFiltered)
  const rows = table.getRowModel().rows

  return (
    <Box className={classes.page}>
      <AlertDetailDrawer
        alert={activeAlert}
        comments={activeAlert ? (alertComments[activeAlert.id] ?? []) : []}
        onClose={() => setActiveAlertId(null)}
        onAddComment={addAlertComment}
        onIgnore={ignoreAlert}
        onRunAnalysis={runAnalysis}
      />
      <Paper radius="md" p={0} withBorder>
        <Group
          gap={12}
          px={18}
          py={14}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text fz={14} fw={600}>
            All alerts
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
            {totalFiltered} alerts
          </Text>
          <Group gap="xs" ml="auto">
            {selectMode && (
              <>
                <Button
                  size="xs"
                  color="green"
                  onClick={createCase}
                  disabled={selectedCount < 1}
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
            )}
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
              variant="default"
              size="xs"
              leftSection={!selectMode ? <ListChecks size={14} /> : undefined}
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              aria-pressed={selectMode}
            >
              {selectMode ? 'Cancel' : 'Select'}
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
        </Group>

        <Table.ScrollContainer minWidth={820}>
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
                        {...headerProps}
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                        w={header.column.id === 'select' ? 40 : undefined}
                      >
                        {canSort ? (
                          <Group
                            gap={4}
                            wrap="nowrap"
                            onClick={header.column.getToggleSortingHandler()}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {label}
                            {sorted === 'asc' ? (
                              <ChevronUp size={12} />
                            ) : sorted === 'desc' ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
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
                        : openAlert(row.original.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        selectMode
                          ? row.toggleSelected()
                          : openAlert(row.original.id)
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      const stop =
                        cell.column.id === 'select' ||
                        cell.column.id === 'actions'
                      return (
                        <Table.Td
                          key={cell.id}
                          ta={meta?.ta}
                          visibleFrom={meta?.visibleFrom}
                          onClick={
                            stop ? (e) => e.stopPropagation() : undefined
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
                    No alerts match the current filters.
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
            {rangeStart}–{rangeEnd} of {totalFiltered}
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
                onChange={(v) => setPageSize(Number(v ?? '10'))}
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

function AlertDetailDrawer({
  alert,
  comments,
  onClose,
  onAddComment,
  onIgnore,
  onRunAnalysis,
}: {
  alert: Alert | null
  comments: string[]
  onClose: () => void
  onAddComment: (id: string, note: string) => void
  onIgnore: (id: string) => void
  onRunAnalysis: (id: string) => void
}) {
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState('generic')

  const selectedTemplate =
    caseTemplatesList.find((template) => template.id === templateId) ??
    caseTemplatesList[0]

  const close = () => {
    setNote('')
    onClose()
  }

  if (!alert) return null

  const tlpName = TLP[alert.tlp]
  const reference = `${alert.src.toLowerCase().replace(/\s+/g, '-')}:${alert.id.toLowerCase()}`

  return (
    <Drawer
      opened
      onClose={close}
      position="right"
      size="min(520px, 94vw)"
      padding={0}
      title={<VisuallyHidden>Alert detail</VisuallyHidden>}
      aria-label="Alert detail"
      closeButtonProps={{ 'aria-label': 'Close alert detail' }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      styles={{
        content: { borderLeft: '1px solid var(--line-soft)' },
        header: {
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--line-soft)',
          padding: '18px 22px 0',
        },
        body: { padding: 0 },
      }}
    >
      <Box
        style={{
          borderLeft: `4px solid var(--sev-${SEV[alert.sev]})`,
          marginTop: -44,
          paddingTop: 44,
        }}
      >
        <Box px={22} pb={16}>
          <Text ff="monospace" fz={11} c="dimmed" mb={6}>
            ALERT {alert.id}
          </Text>
          <Text fw={700} fz={18} lh={1.25} pr={36}>
            {alert.title}
          </Text>
          <Group gap={7} mt={12} wrap="wrap">
            <Badge color="red" variant="light" radius="sm" ff="monospace">
              {SEV[alert.sev].toUpperCase()}
            </Badge>
            <Badge
              color={TLP_COLOR[tlpName]}
              variant="light"
              radius="sm"
              ff="monospace"
            >
              TLP:{tlpName.toUpperCase()}
            </Badge>
            {alert.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </Group>
        </Box>

        <DrawerSection title="Details">
          <KeyValue label="Source">{alert.src}</KeyValue>
          <KeyValue label="First seen">{fmtAge(alert.ageMin)} ago</KeyValue>
          <KeyValue label="SLA">
            <Text component="span" c={alert.breach ? 'red.6' : 'green.7'}>
              {alert.breach ? 'breached' : 'within SLA'}
            </Text>
          </KeyValue>
          <KeyValue label="Status">Read</KeyValue>
          <KeyValue label="Reference">
            <Text component="span" ff="monospace" fz={12}>
              {reference}
            </Text>
          </KeyValue>
        </DrawerSection>

        <DrawerSection title="Description">
          <Text fz={14} lh={1.45} c="var(--text)">
            {alert.description}
          </Text>
        </DrawerSection>

        <DrawerSection
          title="Observables"
          action={
            <Button
              size="xs"
              variant="default"
              leftSection={<Play size={12} />}
              onClick={() => onRunAnalysis(alert.id)}
            >
              Run analyzers
            </Button>
          }
        >
          <Stack gap={0}>
            {alert.observables.map((observable) => (
              <Group
                key={`${observable.type}:${observable.value}`}
                py={7}
                gap={10}
                wrap="nowrap"
                style={{ borderBottom: '1px solid var(--line-soft)' }}
              >
                <Badge variant="outline" color="gray" radius="sm" ff="monospace">
                  {observable.type}
                </Badge>
                <Text fz={13} ff="monospace" truncate>
                  {observable.value}
                </Text>
              </Group>
            ))}
          </Stack>
        </DrawerSection>

        <DrawerSection title="Similar cases">
          {alert.similarCases.length ? (
            <Stack gap={0}>
              {alert.similarCases.map((similar) => (
                <Group
                  key={similar.id}
                  py={8}
                  gap={10}
                  wrap="nowrap"
                  style={{ borderBottom: '1px solid var(--line-soft)' }}
                >
                  <Text ff="monospace" fz={12} c="dimmed">
                    {similar.id}
                  </Text>
                  <Text fz={13} fw={500} truncate style={{ flex: 1 }}>
                    {similar.title}
                  </Text>
                  <Badge size="xs" variant="light" color="blue">
                    {similar.status}
                  </Badge>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text fz={13} c="dimmed">
              No similar cases found.
            </Text>
          )}
        </DrawerSection>

        <DrawerSection title={`Comments ${comments.length}`}>
          <Stack gap={8}>
            {comments.length ? (
              comments.map((comment, index) => (
                <Text key={`${alert.id}-comment-${index}`} fz={13} c="dimmed">
                  {comment}
                </Text>
              ))
            ) : (
              <Text fz={13} c="dimmed">
                No triage notes yet — they transfer to the case on promotion.
              </Text>
            )}
            <Textarea
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder="Triage note... transfers to the case on promotion (Ctrl+Enter)"
              minRows={3}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  onAddComment(alert.id, note)
                  setNote('')
                }
              }}
            />
            <Group justify="flex-end">
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  onAddComment(alert.id, note)
                  setNote('')
                }}
              >
                Post note
              </Button>
            </Group>
          </Stack>
        </DrawerSection>

        <DrawerSection title="Promote with template">
          <Select
            data={caseTemplatesList.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
            value={templateId}
            onChange={(value) => setTemplateId(value ?? 'generic')}
            allowDeselect={false}
          />
          <Text mt={6} ff="monospace" fz={10} c="dimmed">
            pre-loads tasks, custom fields, TLP/PAP & tags
          </Text>
          <Group gap={6} mt={8} wrap="wrap">
            <Tag label={`SEV ${SEV[selectedTemplate.sev].toUpperCase()}`} />
            <Tag label={`TLP ${TLP[selectedTemplate.tlp].toUpperCase()}`} />
            <Tag label={`${selectedTemplate.tasks.length} tasks`} />
            <Tag label={`${selectedTemplate.customFields.length} custom fields`} />
          </Group>
        </DrawerSection>

        <Group
          p={16}
          gap={10}
          wrap="nowrap"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--mantine-color-body)',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <Button
            fullWidth
            variant="default"
            onClick={() => {
              onIgnore(alert.id)
              close()
            }}
          >
            Ignore
          </Button>
          <Button
            fullWidth
            variant="default"
            onClick={() =>
              notifications.show({
                message: `Pick a target case to merge ${alert.id} into`,
              })
            }
          >
            Merge into case...
          </Button>
          <Button
            fullWidth
            color="orange"
            onClick={() =>
              notifications.show({
                color: 'orange',
                message: `${alert.id} promoted using ${selectedTemplate.name}`,
              })
            }
          >
            Promote to case
          </Button>
        </Group>
      </Box>
    </Drawer>
  )
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box px={22} py={16} style={{ borderTop: '1px solid var(--line-soft)' }}>
      <Group mb={10} gap="xs" wrap="nowrap">
        <Text component="h3" {...headerProps} m={0}>
          {title}
        </Text>
        {action && (
          <Group ml="auto" gap={6}>
            {action}
          </Group>
        )}
      </Group>
      {children}
    </Box>
  )
}

function KeyValue({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Group gap={12} mb={6} wrap="nowrap" align="flex-start">
      <Text ff="monospace" fz={12} c="dimmed" w={110}>
        {label}
      </Text>
      <Box fz={13} style={{ flex: 1 }}>
        {children}
      </Box>
    </Group>
  )
}
