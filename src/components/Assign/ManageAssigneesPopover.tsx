import { AssignMenu } from '#/components/Table/AssignMenu'
import { avatarFor } from '#/components/Cases/cases'
import { displayName } from '#/components/Cases/caseUsers'
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Popover,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { X } from 'lucide-react'
import { useState } from 'react'
import type { AssigneeRef } from './assignees'
import { collaboratorIds } from './assignees'
import { AssigneeStack } from './AssigneeStack'

/**
 * The avatar stack plus a "manage assignees" popover: the primary owner is shown
 * (read-only here — set via the entity's primary-assignee control), and
 * collaborators can be added (searchable `AssignMenu`) or removed. Every change
 * emits the full desired collaborator-id set via `onChange` (replace semantics,
 * matching `PUT …/assignees`).
 */
export function ManageAssigneesPopover({
  assignees,
  onChange,
  pending = false,
  disabled = false,
}: {
  assignees: AssigneeRef[]
  onChange: (collaboratorIds: string[]) => void
  pending?: boolean
  disabled?: boolean
}) {
  const [opened, setOpened] = useState(false)
  const collaborators = collaboratorIds(assignees)
  const known = new Set(assignees.map((a) => a.id))

  const addCollaborator = (userId: string) => {
    if (known.has(userId)) return
    onChange([...collaborators, userId])
  }
  const removeCollaborator = (userId: string) => {
    onChange(collaborators.filter((id) => id !== userId))
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withArrow
      shadow="md"
      width={300}
    >
      <Popover.Target>
        <UnstyledButton
          aria-label="Manage assignees"
          disabled={disabled}
          onClick={() => setOpened((o) => !o)}
          style={{ opacity: pending ? 0.6 : undefined }}
        >
          <AssigneeStack assignees={assignees} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text className="assignee-popover-title" fw={700} fz="sm">
            Assignees
          </Text>
          {assignees.length === 0 ? (
            <Text c="dimmed" fz="sm">
              No assignees yet.
            </Text>
          ) : (
            assignees.map((a) => {
              const label = a.email ? displayName(a.email) : a.id
              const [initials, color] = avatarFor(a.email || a.id)
              return (
                <Group key={a.id} justify="space-between" wrap="nowrap" gap="xs">
                  <Group gap={8} wrap="nowrap" miw={0}>
                    <Avatar variant="filled" color={color} size={22} radius="xl">
                      {initials}
                    </Avatar>
                    <Text fz="sm" truncate>
                      {label}
                    </Text>
                    {a.isPrimary ? (
                      <Badge size="xs" variant="light" color="orange">
                        primary
                      </Badge>
                    ) : null}
                  </Group>
                  {a.isPrimary ? null : (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label={`Remove ${label}`}
                      disabled={pending}
                      onClick={() => removeCollaborator(a.id)}
                    >
                      <X size={14} />
                    </ActionIcon>
                  )}
                </Group>
              )
            })
          )}
          <AssignMenu
            label="Add collaborator"
            loading={pending}
            onAssign={(user) => addCollaborator(user.id)}
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
