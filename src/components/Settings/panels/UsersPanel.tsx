import { Button, Code, Table, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  organisationMembersQueryOptions,
  rolesQueryOptions,
} from '#/components/Settings/settingsQueries'
import {
  compactDate,
  LoadingPanel,
  notify,
  Panel,
  RoleBadge,
  TableBox,
} from '#/components/Settings/settingsUi'

export function UsersPanel() {
  const { data: members = [], isPending } = useQuery(
    organisationMembersQueryOptions(),
  )
  const { data: roles = [] } = useQuery(rolesQueryOptions())
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  )

  if (isPending) return <LoadingPanel label="Loading members..." />

  return (
    <Panel
      title="Members"
      count={members.length}
      action={
        <Button
          variant="default"
          onClick={() => notify('Invite user workflow opened')}
        >
          + Invite user
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Last active</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member) => {
              const role = roleById.get(member.role_id) ?? member.role_id
              return (
                <Table.Tr key={member.id}>
                  <Table.Td fw={700}>{member.email.split('@')[0]}</Table.Td>
                  <Table.Td>
                    <Code>{member.email}</Code>
                  </Table.Td>
                  <Table.Td>
                    <RoleBadge role={role} />
                  </Table.Td>
                  <Table.Td ff="monospace" c="var(--faint)">
                    {compactDate(member.created_at)}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() =>
                        notify(`Edit member ${member.email} workflow opened`)
                      }
                    >
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {members.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    No members returned by the backend.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}
