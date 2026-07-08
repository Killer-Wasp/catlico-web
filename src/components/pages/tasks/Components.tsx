import type { Task, TaskStatus } from '#/components/Tasks/tasks.types'
import {
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  avatarFor,
} from '#/components/Tasks/tasks'
import {
  localDateTimeLabel,
  relativeTimeLabel,
} from '#/components/Time/RelativeTime'
import { Avatar, Badge, Text, Tooltip } from '@mantine/core'
import { Clock3 } from 'lucide-react'

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
  const label = relativeTimeLabel(task.dueAt, task.due)
  const badge = (
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

  if (!task.dueAt) return badge

  return (
    <Tooltip label={localDateTimeLabel(task.dueAt)} withArrow>
      {badge}
    </Tooltip>
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
