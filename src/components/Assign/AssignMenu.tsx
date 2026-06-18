import { AV } from '#/components/Cases/cases'
import { Button, Menu, Text } from '@mantine/core'
import { useState } from 'react'

// Analyst roster for assignment, minus the "Unassigned" placeholder.
const ASSIGNEES = Object.keys(AV).filter((name) => name !== 'Unassigned')

type AssignMenuProps = {
  /** Number of selected rows — drives the label count and disabled state. */
  count: number
  /** Called with the chosen analyst's name. */
  onAssign: (name: string) => void
}

/**
 * "Assign to" button with a searchable analyst dropdown, used by the
 * Alerts and Cases bulk-action bars. Disabled until at least one row is
 * selected; resets its search query each time the menu closes.
 */
export function AssignMenu({ count, onAssign }: AssignMenuProps) {
  const [query, setQuery] = useState('')
  const matches = ASSIGNEES.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase().trim()),
  )

  return (
    <Menu
      shadow="md"
      width={220}
      position="bottom-start"
      onClose={() => setQuery('')}
    >
      <Menu.Target>
        <Button size="xs" color="green" disabled={count < 1}>
          {count ? `Assign to (${count})` : 'Assign to'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Search
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search analysts"
        />
        {matches.length > 0 ? (
          matches.map((name) => (
            <Menu.Item key={name} onClick={() => onAssign(name)}>
              {name}
            </Menu.Item>
          ))
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="xs">
            Nothing found
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
