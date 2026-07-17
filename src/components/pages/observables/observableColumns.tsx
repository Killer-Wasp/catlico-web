import type { Observable } from '#/components/Observables/observables.types'
import { RelativeTime } from '#/components/Time/RelativeTime'
import { TableTlpBadge } from '#/components/Tlp/TableTlpBadge'
import { ActionIcon, Checkbox, Group, Menu, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { ColumnDef } from '@tanstack/react-table'
import { Play, Settings } from 'lucide-react'
import { TypeIcon } from './Pills'
import {
  includesAnySubstring,
  includesOne as includesOneString,
} from '#/components/Table/tableFilters'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { byAdded } from './tableFns'

export function buildObservableColumns(): ColumnDef<Observable>[] {
  return [
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
      meta: { minWidth: 96, nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Group gap={6} wrap="nowrap">
          <TypeIcon type={row.original.type} />
          <Text fz={12} style={{ whiteSpace: 'nowrap' }}>
            {row.original.type}
          </Text>
        </Group>
      ),
    },
    {
      id: 'value',
      header: 'Value',
      accessorFn: (row) => row.value,
      filterFn: includesAnySubstring,
      enableSorting: true,
      cell: ({ row }) => (
        <Group gap={10} wrap="nowrap" align="center">
          <Text
            ff="monospace"
            fz={13}
            fw={600}
            style={{ whiteSpace: 'nowrap' }}
          >
            {row.original.value}
          </Text>
          {row.original.attachment ? (
            <Text fz={11} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {row.original.attachment.filename}
            </Text>
          ) : null}
        </Group>
      ),
    },
    {
      id: 'tlp',
      header: 'TLP',
      accessorFn: (row) => row.tlp,
      filterFn: includesOneString,
      enableSorting: false,
      meta: { minWidth: 64, nowrap: true } satisfies TableColumnMeta,
      cell: (info) => (
        <TableTlpBadge tlp={info.getValue<Observable['tlp']>()} />
      ),
    },
    {
      id: 'source',
      header: 'Source',
      accessorFn: (row) => row.source,
      filterFn: includesOneString,
      enableSorting: false,
      meta: { minWidth: 88, nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Text fz={12} style={{ whiteSpace: 'nowrap' }}>
          {row.original.source}
        </Text>
      ),
    },
    {
      id: 'analysis',
      header: 'Analysis',
      accessorFn: (row) => row.analysis?.verdict ?? '',
      filterFn: includesAnySubstring,
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Text fz={12}>
          {row.original.analysis ? `${row.original.analysis.analyzer} ${row.original.analysis.verdict}` : '-'}
        </Text>
      ),
    },
    {
      id: 'added',
      header: 'Added',
      accessorFn: (row) => row.added,
      enableColumnFilter: false,
      enableSorting: true,
      sortingFn: byAdded,
      meta: { visibleFrom: 'sm' },
      cell: ({ row }) => (
        <RelativeTime
          iso={row.original.addedAt}
          ff="monospace"
          fz={12}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        />
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
              aria-label={`Observable ${row.original.value} actions`}
            >
              <Settings size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<Play size={14} fill="currentColor" />}
              onClick={() =>
                notifications.show({
                  message: `Analyzer queued for ${row.original.value}`,
                })
              }
            >
              Analyze
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
