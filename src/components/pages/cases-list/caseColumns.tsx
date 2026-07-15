import type { Case } from '#/components/Cases/cases.types'
import { avatarFor } from '#/components/Cases/cases'
import { AssigneeStack } from '#/components/Assign/AssigneeStack'
import type { CaseStatus } from '#/lib/domain'
import { Severity } from '#/components/Severity/Severity'
import { SlaChip } from '#/components/Cases/SlaChip'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Tag } from '#/components/Tag/Tag'
import { RelativeTime } from '#/components/Time/RelativeTime'
import {
  ActionIcon,
  Avatar,
  Box,
  Checkbox,
  Group,
  Menu,
  Progress,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Settings, UserPlus } from 'lucide-react'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import {
  includesAnySubstring,
  includesAnyTag,
  includesOne,
} from '#/components/Table/tableFilters'
import { byCaseId, byCreated, byUpdated } from './tableFns'

function AssigneeAvatar({ name }: { name: string }) {
  const [initials, color] = avatarFor(name)
  return (
    <Avatar
      variant="filled"
      color={color}
      size={24}
      radius="xl"
      display="inline-flex"
    >
      {initials}
    </Avatar>
  )
}

export function buildCaseColumns({
  openCase,
  assignees,
}: {
  openCase: (id: string) => void
  assignees: string[]
}): ColumnDef<Case>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          size="xs"
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all cases"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          size="xs"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select case ${row.original.id}`}
        />
      ),
      enableColumnFilter: false,
      meta: { ta: 'center' } satisfies TableColumnMeta,
    },
    {
      id: 'id',
      header: 'Case',
      accessorFn: (row) => row.sev,
      filterFn: includesOne,
      enableSorting: true,
      sortingFn: byCaseId,
      meta: { nowrap: true } satisfies TableColumnMeta,
      cell: (info) => (
        <Severity
          id={info.row.original.id}
          sev={info.getValue<Case['sev']>()}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (row) => row.status,
      filterFn: includesOne,
      enableSorting: false,
      meta: { minWidth: 112, nowrap: true } satisfies TableColumnMeta,
      // The table status is intentionally read-only: it renders a presentational
      // StatusBadge, not an editable control. Status is changed only from the case
      // detail view; the row click merely navigates there.
      cell: (info) => (
        <StatusBadge
          status={info.getValue<CaseStatus>()}
          label={info.row.original.statusName}
        />
      ),
    },
    {
      id: 'title',
      header: 'Title',
      accessorFn: (row) => row.title,
      filterFn: includesAnySubstring,
      enableSorting: false,
      meta: { grow: true } satisfies TableColumnMeta,
      cell: (info) => {
        const tags = info.row.original.tags
        return (
          <Box>
            <Text
              fw={500}
              truncate
              onClick={() => openCase(info.row.original.id)}
              style={{ cursor: 'pointer' }}
            >
              {info.getValue<string>()}
            </Text>
            <Group gap={6} mt={4} wrap="wrap">
              <SlaChip
                state={info.row.original.slaState}
                dueAt={info.row.original.slaDueAt}
                size="xs"
              />
              {tags.map((t) => (
                <Tag key={t} label={t} />
              ))}
            </Group>
          </Box>
        )
      },
    },
    {
      id: 'tasks',
      header: 'Tasks',
      accessorFn: (row) => ({ done: row.tasksDone, total: row.tasksTotal }),
      enableColumnFilter: false,
      enableSorting: false,
      meta: { visibleFrom: 'md', nowrap: true } satisfies TableColumnMeta,
      cell: (info) => {
        const { done, total: taskTotal } = info.getValue<{
          done: number
          total: number
        }>()
        const pct = taskTotal ? (done / taskTotal) * 100 : 0
        return (
          <Group gap={8} wrap="nowrap" miw={110}>
            <Progress
              value={pct}
              size={5}
              radius="xl"
              color="var(--sev-low)"
              flex={1}
            />
            <Text
              ff="monospace"
              fz={10.5}
              c="var(--muted)"
              style={{ whiteSpace: 'nowrap' }}
            >
              {done}/{taskTotal}
            </Text>
          </Group>
        )
      },
    },
    {
      id: 'assignee',
      header: 'Assignee',
      accessorFn: (row) => row.assignee,
      filterFn: includesOne,
      enableSorting: false,
      meta: {
        visibleFrom: 'md',
        ta: 'center',
        compact: true,
        nowrap: true,
      } satisfies TableColumnMeta,
      cell: (info) => {
        const rowAssignees = info.row.original.assignees
        // Prefer the full stack; fall back to the single resolved email while a
        // cached row predates the multi-assignee field.
        return rowAssignees && rowAssignees.length > 0 ? (
          <AssigneeStack assignees={rowAssignees} />
        ) : (
          <AssigneeAvatar name={info.getValue<string>()} />
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
      id: 'caseNo',
      accessorFn: (row) => row.id,
      filterFn: includesAnySubstring,
      // Filter-only column for the `case:` token; never rendered.
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'created',
      header: 'Created',
      accessorFn: (row) => row.created,
      enableColumnFilter: false,
      enableSorting: true,
      sortingFn: byCreated,
      meta: { visibleFrom: 'lg', nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <RelativeTime
          iso={row.original.createdAt}
          ff="monospace"
          fz={11}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        />
      ),
    },
    {
      id: 'updated',
      header: 'Updated',
      accessorFn: (row) => row.updated,
      enableColumnFilter: false,
      enableSorting: true,
      sortingFn: byUpdated,
      meta: { nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <RelativeTime
          iso={row.original.updatedAt}
          ff="monospace"
          fz={11}
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
      meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Menu position="bottom-end" withArrow shadow="md">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Case ${row.original.id} actions`}
            >
              <Settings size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<ExternalLink size={14} />}
              onClick={() => openCase(row.original.id)}
            >
              Open case
            </Menu.Item>
            <Menu.Sub>
              <Menu.Sub.Target>
                <Menu.Sub.Item leftSection={<UserPlus size={14} />}>
                  Assign to
                </Menu.Sub.Item>
              </Menu.Sub.Target>
              <Menu.Sub.Dropdown>
                {assignees.map((name) => (
                  <Menu.Item
                    key={name}
                    onClick={() =>
                      notifications.show({
                        message: `${row.original.id} assigned to ${name}`,
                      })
                    }
                  >
                    {name}
                  </Menu.Item>
                ))}
              </Menu.Sub.Dropdown>
            </Menu.Sub>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
