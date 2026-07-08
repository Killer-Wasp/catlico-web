import type { Alert } from '#/components/Alerts/alerts.types'
import { srcColor } from '#/components/Alerts/alerts'
import { alertTagsQueryOptions } from '#/components/Alerts/alertsQueries'
import { Severity } from '#/components/Severity/Severity'
import { Tag } from '#/components/Tag/Tag'
import { TableTlpBadge } from '#/components/Tlp/TableTlpBadge'
import { RelativeTime } from '#/components/Time/RelativeTime'
import {
  ActionIcon,
  Box,
  Checkbox,
  ColorSwatch,
  Group,
  Menu,
  Text,
} from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeOff, Settings, Sparkles } from 'lucide-react'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import {
  includesAnySubstring,
  includesAnyTag,
  includesOne,
} from '#/components/Table/tableFilters'
import { useQuery } from '@tanstack/react-query'
import { byAge, byAlertId } from './tableFns'

type AlertColumnHandlers = {
  onRunAnalysis: (id: string) => void
  onDismiss: (id: string) => void
}

function AlertTitleCell({ alert }: { alert: Alert }) {
  const { data: fetchedTags } = useQuery(alertTagsQueryOptions(alert.id))
  const tags = fetchedTags ?? alert.tags

  return (
    <Box>
      <Text fw={500} truncate>
        {alert.title}
      </Text>
      {tags.length > 0 ? (
        <Group gap={6} mt={4} wrap="wrap">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </Group>
      ) : null}
    </Box>
  )
}

export function buildAlertColumns({
  onRunAnalysis,
  onDismiss,
}: AlertColumnHandlers): ColumnDef<Alert>[] {
  return [
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
      meta: { nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Severity id={row.original.id} sev={row.original.sev} />
      ),
    },
    {
      id: 'title',
      header: 'Title',
      accessorFn: (row) => row.title,
      filterFn: includesAnySubstring,
      enableSorting: false,
      meta: { grow: true } satisfies TableColumnMeta,
      cell: ({ row }) => <AlertTitleCell alert={row.original} />,
    },
    {
      id: 'source',
      header: 'Source',
      accessorFn: (row) => row.src,
      filterFn: includesOne,
      enableSorting: false,
      meta: { nowrap: true } satisfies TableColumnMeta,
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
      meta: { minWidth: 64, nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => <TableTlpBadge tlp={row.original.tlp} />,
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
      meta: { nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <RelativeTime
          iso={row.original.firstSeenAt}
          fallback={`${row.original.ageMin} minutes ago`}
          ff="monospace"
          fz={11}
          c={row.original.breach ? 'var(--sev-critical)' : 'dimmed'}
          style={{ whiteSpace: 'nowrap' }}
          suffix={row.original.breach ? ' ⚠' : undefined}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
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
              onClick={() => onRunAnalysis(row.original.id)}
            >
              Run analysis
            </Menu.Item>
            <Menu.Item
              leftSection={<EyeOff size={14} />}
              onClick={() => onDismiss(row.original.id)}
            >
              Dismiss
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
