import type { Task } from '#/components/Tasks/tasks.types'
import { Severity } from '#/components/Severity/Severity'
import {
  ActionIcon,
  Badge,
  Box,
  Checkbox,
  Group,
  Menu,
  Text,
} from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, EllipsisVertical, ExternalLink, Play } from 'lucide-react'
import { Assignee, DuePill, TaskStatusBadge } from './Components'
import { AssigneeStack } from '#/components/Assign/AssigneeStack'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { markdownPreview } from '#/lib/markdownPreview'
import {
  includesAnySubstring,
  includesOne,
} from '#/components/Table/tableFilters'
import { byCaseId, byDueDate } from './tableFns'

export function buildTaskColumns({
  onOpenCase,
  onAdvance,
  onComplete,
}: {
  onOpenCase: (caseId: string) => void
  onAdvance: (task: Task) => void
  onComplete: (task: Task) => void
}): ColumnDef<Task>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          size="xs"
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all tasks"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          size="xs"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select ${row.original.title}`}
        />
      ),
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'center' },
    },
    {
      id: 'caseId',
      header: 'Case',
      accessorFn: (row) => row.caseId,
      filterFn: includesAnySubstring,
      sortingFn: byCaseId,
      meta: { nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Severity
          id={row.original.caseId}
          sev={row.original.caseSeverity === 'critical' ? 4 : 3}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (row) => row.status,
      filterFn: includesOne,
      meta: {
        compact: true,
        ta: 'center',
        nowrap: true,
      } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <TaskStatusBadge
          status={row.original.status}
          onAdvance={() => onAdvance(row.original)}
        />
      ),
    },
    {
      id: 'title',
      header: 'Task',
      accessorFn: (row) => row.title,
      filterFn: includesAnySubstring,
      meta: { grow: true } satisfies TableColumnMeta,
      cell: ({ row }) => {
        const task = row.original
        return (
          <Box>
            <Group gap={8} wrap="wrap">
              <Text fw={700} size="sm">
                {task.title}
                {task.flagged ? (
                  <Text
                    component="span"
                    c="var(--sev-medium)"
                    ml={4}
                    aria-label="Flagged task"
                  >
                    |
                  </Text>
                ) : null}
              </Text>
              <Badge
                variant="default"
                radius="sm"
                size="sm"
                ff="monospace"
                tt="none"
                fw={500}
              >
                {task.kind}
              </Badge>
            </Group>
            <Text mt={3} ff="monospace" fz={11} c="dimmed" lineClamp={1}>
              {markdownPreview(task.description)}
            </Text>
          </Box>
        )
      },
    },
    {
      id: 'kind',
      accessorFn: (row) => row.kind,
      filterFn: includesOne,
      // Filter-only column for the `kind:` token; rendered inline above.
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'assignee',
      header: 'Assignee',
      accessorFn: (row) => row.assignee ?? 'Unassigned',
      filterFn: includesOne,
      meta: {
        compact: true,
        ta: 'center',
        nowrap: true,
      } satisfies TableColumnMeta,
      cell: ({ row }) => {
        const assignees = row.original.assignees
        return assignees && assignees.length > 0 ? (
          <AssigneeStack assignees={assignees} />
        ) : (
          <Assignee name={row.original.assignee} />
        )
      },
    },
    {
      id: 'due',
      header: 'Due',
      accessorFn: (row) => row.due,
      enableColumnFilter: false,
      sortingFn: byDueDate,
      meta: {
        compact: true,
        ta: 'center',
        nowrap: true,
      } satisfies TableColumnMeta,
      cell: ({ row }) => <DuePill task={row.original} />,
    },
    {
      id: 'actions',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
      cell: ({ row }) => {
        const task = row.original
        const canAdvance =
          task.status === 'waiting' || task.status === 'inprogress'
        const canComplete =
          task.status !== 'completed' && task.status !== 'cancelled'
        return (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="md"
                title="Task actions"
                aria-label={`Task actions for ${task.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <EllipsisVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
              <Menu.Item
                leftSection={<ExternalLink size={14} />}
                onClick={() => onOpenCase(task.caseId)}
              >
                Open case
              </Menu.Item>
              <Menu.Item
                leftSection={<Play size={14} />}
                disabled={!canAdvance}
                onClick={() => onAdvance(task)}
              >
                Advance status
              </Menu.Item>
              <Menu.Item
                leftSection={<Check size={14} />}
                disabled={!canComplete}
                onClick={() => onComplete(task)}
              >
                Complete task
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )
      },
    },
  ]
}
