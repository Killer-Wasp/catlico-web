import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { Box, Group, Switch, Text } from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { ProfileBadge, TriggerBadge } from './Badges'
import type { FunctionAutomation } from './model'

export function buildFunctionColumns({
  onToggle,
}: {
  onToggle: (id: number, enabled: boolean) => void
}): ColumnDef<FunctionAutomation>[] {
  return [
    {
      id: 'function',
      header: 'Function',
      accessorFn: (row) => row.name,
      enableSorting: false,
      cell: ({ row }) => (
        <Box maw={420}>
          <Text fw={700} c="dark.9">
            {row.original.name}
          </Text>
          <Text c="dimmed" size="sm">
            {row.original.description}
          </Text>
        </Box>
      ),
    },
    {
      id: 'trigger',
      header: 'Trigger',
      enableSorting: false,
      cell: ({ row }) => <TriggerBadge trigger={row.original.trigger} />,
    },
    {
      id: 'profile',
      header: 'Runs as',
      enableSorting: false,
      cell: ({ row }) => <ProfileBadge profile={row.original.profile} />,
    },
    {
      id: 'runs',
      header: 'Runs / errors',
      enableSorting: false,
      cell: ({ row }) => (
        <Group gap={8}>
          <Text fw={700}>{row.original.runCount}</Text>
          {row.original.errorCount ? (
            <>
              <Text c="dimmed">·</Text>
              <Text c="red.7" ff="monospace">
                {row.original.errorCount} err
              </Text>
            </>
          ) : null}
        </Group>
      ),
    },
    {
      id: 'lastRun',
      header: 'Last run',
      enableSorting: false,
      cell: ({ row }) => (
        <Text ff="monospace" c="dimmed">
          {row.original.runs[0]?.started ?? '-'}
        </Text>
      ),
    },
    {
      id: 'enabled',
      header: 'Enabled',
      enableSorting: false,
      meta: { ta: 'left' } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Switch
          color="lime"
          checked={row.original.enabled}
          onChange={(event) =>
            onToggle(row.original.id, event.currentTarget.checked)
          }
          aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
        />
      ),
    },
  ]
}
