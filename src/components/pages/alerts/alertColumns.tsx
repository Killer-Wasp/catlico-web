import type { Alert } from '#/components/Alerts/alerts.types'
import { fmtAge, srcColor } from '#/components/Alerts/alerts'
import { TLP, TLP_COLOR } from '#/lib/domain'
import { Severity } from '#/components/Severity/Severity'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  ColorSwatch,
  Group,
  Menu,
  Text,
} from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeOff, Settings, Sparkles } from 'lucide-react'
import {
  includesAnySubstring,
  includesAnyTag,
  includesOne,
} from '#/components/Table/tableFilters'
import { byAge, byAlertId } from './tableFns'

type AlertColumnHandlers = {
  onRunAnalysis: (id: string) => void
  onIgnore: (id: string) => void
}

export function buildAlertColumns({
  onRunAnalysis,
  onIgnore,
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
              onClick={() => onRunAnalysis(row.original.id)}
            >
              Run analysis
            </Menu.Item>
            <Menu.Item
              leftSection={<EyeOff size={14} />}
              onClick={() => onIgnore(row.original.id)}
            >
              Ignore
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
