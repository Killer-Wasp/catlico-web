import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from '#/components/Observables/observables.types'
import { Badge, Button, Checkbox, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { ColumnDef } from '@tanstack/react-table'
import { Play } from 'lucide-react'
import { AnalysisPill, TlpPill, TypePill } from './Pills'
import {
  byAdded,
  flagLabel,
  includesAnyFlag,
  includesAnySubstring,
  includesOneString,
} from './tableFns'

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
      cell: (info) => <TypePill type={info.getValue<ObservableType>()} />,
    },
    {
      id: 'value',
      header: 'Value',
      accessorFn: (row) => row.value,
      filterFn: includesAnySubstring,
      enableSorting: true,
      cell: (info) => (
        <Text ff="monospace" fz={13} fw={600} style={{ whiteSpace: 'nowrap' }}>
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
  ]
}
