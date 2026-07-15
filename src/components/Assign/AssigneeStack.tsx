import { avatarFor } from '#/components/Cases/cases'
import { displayName } from '#/components/Cases/caseUsers'
import { Avatar, Tooltip } from '@mantine/core'
import type { AssigneeRef } from './assignees'

/**
 * An overlapping stack of assignee avatars (primary first, ringed). Falls back to
 * a single "Unassigned" avatar when there are none. Purely presentational — the
 * add/remove affordance lives in `ManageAssigneesPopover`.
 */
export function AssigneeStack({
  assignees,
  size = 24,
  max = 4,
}: {
  assignees: AssigneeRef[]
  size?: number
  max?: number
}) {
  if (assignees.length === 0) {
    const [initials, color] = avatarFor('Unassigned')
    return (
      <Avatar
        variant="filled"
        color={color}
        size={size}
        radius="xl"
        display="inline-flex"
        aria-label="Unassigned"
      >
        {initials}
      </Avatar>
    )
  }

  const shown = assignees.slice(0, max)
  const overflow = assignees.length - shown.length

  return (
    <Avatar.Group>
      {shown.map((a) => {
        const label = a.email || a.id
        const [initials, color] = avatarFor(label)
        const name = a.email ? displayName(a.email) : a.id
        return (
          <Tooltip
            key={a.id}
            label={a.isPrimary ? `${name} (primary)` : name}
            withArrow
          >
            <Avatar
              variant="filled"
              color={color}
              size={size}
              radius="xl"
              aria-label={a.isPrimary ? `${name} (primary)` : name}
              style={
                a.isPrimary
                  ? {
                      outline:
                        '2px solid light-dark(var(--mantine-color-orange-6), var(--mantine-color-orange-4))',
                    }
                  : undefined
              }
            >
              {initials}
            </Avatar>
          </Tooltip>
        )
      })}
      {overflow > 0 ? (
        <Avatar size={size} radius="xl" aria-label={`${overflow} more`}>
          +{overflow}
        </Avatar>
      ) : null}
    </Avatar.Group>
  )
}
