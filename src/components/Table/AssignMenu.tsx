import { UserAvatar } from '#/components/Users/UserAvatar'
import type { UserPublic } from '#/components/Users/usersQueries'
import {
  userDisplayName,
  userSearchQueryOptions,
} from '#/components/Users/usersQueries'
import {
  Button,
  Center,
  Loader,
  Menu,
  ScrollArea,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'

type AssignMenuProps = {
  onAssign: (user: UserPublic) => void
  /** Disable the trigger (e.g. nothing selected). */
  disabled?: boolean
  /** Show a loading state on the trigger while the assignment is in flight. */
  loading?: boolean
  label?: string
}

/**
 * Trigger button that opens a searchable menu of org users — each row an avatar
 * plus display name. Search runs server-side via `GET /users/search`. Reused
 * anywhere a selection is bulk-assigned to a user (tasks, cases).
 */
export function AssignMenu({
  onAssign,
  disabled = false,
  loading = false,
  label = 'Assign to',
}: AssignMenuProps) {
  const [opened, setOpened] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search, 200)

  const { data: users = [], isFetching } = useQuery({
    ...userSearchQueryOptions(debounced),
    // Only hit the endpoint while the menu is open.
    enabled: opened,
  })

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      // Reset the query each time the menu closes.
      onClose={() => setSearch('')}
    >
      <Menu.Target>
        <Button
          size="xs"
          leftSection={<UserPlus size={14} />}
          disabled={disabled}
          loading={loading}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <TextInput
          size="xs"
          placeholder="Search people"
          data-autofocus
          leftSection={<Search size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          // Keep typing inside the field — don't let the Menu's keyboard nav
          // (typeahead / arrow keys) hijack the keystrokes.
          onKeyDown={(event) => event.stopPropagation()}
          mb={4}
        />
        <ScrollArea.Autosize mah={260} type="scroll">
          {isFetching && users.length === 0 ? (
            <Center py="sm">
              <Loader size="xs" />
            </Center>
          ) : users.length > 0 ? (
            users.map((user) => (
              <Menu.Item
                key={user.id}
                onClick={() => onAssign(user)}
                leftSection={<UserAvatar user={user} size={22} />}
              >
                {userDisplayName(user)}
              </Menu.Item>
            ))
          ) : (
            <Text c="dimmed" fz="sm" ta="center" py="xs">
              No people found
            </Text>
          )}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  )
}
