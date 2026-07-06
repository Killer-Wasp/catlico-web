import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import {
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  avatarFor,
} from '#/components/Tasks/tasks'
import { Avatar, Badge, Text, Tooltip } from '@mantine/core'
import { Clock3 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function Assignee({ name }: { name?: string }) {
  if (!name) {
    return (
      <Text component="span" fs="italic" c="dimmed">
        Unassigned
      </Text>
    )
  }
  const [initials, color] = avatarFor(name)
  return (
    <Tooltip label={name} withArrow>
      <Avatar
        color={color}
        size={28}
        radius="xl"
        mx="auto"
        aria-label={name}
      >
        {initials}
      </Avatar>
    </Tooltip>
  )
}

export function DuePill({ task }: { task: Task }) {
  const urgent = task.urgent || task.overdue
  const label = task.dueAt ? dayjs(task.dueAt).fromNow() : task.due
  return (
    <Badge
      variant="light"
      color={task.overdue ? 'red' : urgent ? 'red' : 'gray'}
      radius="sm"
      size="sm"
      ff="monospace"
      leftSection={<Clock3 size={12} />}
      styles={{
        root: {
          textTransform: 'none',
          border: urgent ? '1px solid var(--mantine-color-red-3)' : undefined,
        },
      }}
    >
      {label}
    </Badge>
  )
}

export function TaskStatusBadge({
  status,
  onAdvance,
}: {
  status: TaskStatus
  onAdvance: () => void
}) {
  return (
    <Badge
      component="button"
      type="button"
      variant="light"
      color={TASK_STATUS_COLOR[status]}
      radius="sm"
      size="sm"
      ff="monospace"
      onClick={(event) => {
        // Keep status advances on the badge — don't bubble to the row's
        // navigate-to-case handler.
        event.stopPropagation()
        onAdvance()
      }}
      styles={{
        root: {
          border: 0,
          cursor:
            status === 'waiting' || status === 'inprogress'
              ? 'pointer'
              : 'default',
        },
      }}
    >
      {TASK_STATUS_LABEL[status]}
    </Badge>
  )
}
