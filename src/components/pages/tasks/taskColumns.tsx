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
      id: 'complete',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'center' },
      cell: ({ row }) => (
        <Checkbox
          size="sm"
          checked={row.original.status === 'completed'}
          disabled={row.original.status === 'cancelled'}
          onChange={() => onComplete(row.original)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Complete ${row.original.title}`}
        />
      ),
    },
    {
      id: 'caseId',
      header: 'Case',
      accessorFn: (row) => row.caseId,
      filterFn: includesAnySubstring,
      sortingFn: byCaseId,
      cell: ({ row }) => (
        <Severity
          id={row.original.caseId}
          sev={row.original.caseSeverity === 'critical' ? 4 : 3}
        />
      ),
    },
    {
      id: 'title',
      header: 'Task',
      accessorFn: (row) => row.title,
      filterFn: includesAnySubstring,
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
            <Text mt={3} ff="monospace" fz={11} c="dimmed">
              {task.description}
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
      cell: ({ row }) => <Assignee name={row.original.assignee} />,
    },
    {
      id: 'due',
      header: 'Due',
      accessorFn: (row) => row.due,
      enableColumnFilter: false,
      sortingFn: byDueDate,
      cell: ({ row }) => <DuePill task={row.original} />,
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (row) => row.status,
      filterFn: includesOne,
      cell: ({ row }) => (
        <TaskStatusBadge
          status={row.original.status}
          onAdvance={() => onAdvance(row.original)}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'right' },
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
