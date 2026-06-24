import { Button, Code, Group, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createOrganisationMember,
  organisationMembersQueryOptions,
  removeOrganisationMember,
  rolesQueryOptions,
  settingsKeys,
  updateOrganisationMember,
} from '#/components/Settings/settingsQueries'
import type { OrganisationMemberPublic } from '#/components/Settings/settingsQueries'
import {
  compactDate,
  LoadingPanel,
  Panel,
  RoleBadge,
  TableBox,
} from '#/components/Settings/settingsUi'

function InviteMemberModal({
  opened,
  onClose,
  roleIds,
}: {
  opened: boolean
  onClose: () => void
  roleIds: { value: string; label: string }[]
}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState(roleIds[0]?.value ?? '')

  const mutation = useMutation({
    mutationFn: () => createOrganisationMember({ user_id: userId.trim(), role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Member added' })
      setUserId('')
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to add member',
      }),
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Invite user">
      <Stack gap="md">
        <TextInput
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.currentTarget.value)}
          required
        />
        <Select
          label="Role"
          data={roleIds}
          value={roleId}
          onChange={(v) => setRoleId(v ?? roleIds[0]?.value ?? '')}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={mutation.isPending}
            disabled={!userId.trim()}
            onClick={() => mutation.mutate()}
          >
            Add member
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function EditMemberModal({
  opened,
  member,
  roleIds,
  onClose,
}: {
  opened: boolean
  member: OrganisationMemberPublic | null
  roleIds: { value: string; label: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [roleId, setRoleId] = useState(member?.role_id ?? '')

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrganisationMember(member!.user_id, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Member role updated' })
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to update member',
      }),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeOrganisationMember(member!.user_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'orange', message: 'Member removed' })
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to remove member',
      }),
  })

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit ${member?.email ?? 'member'}`}>
      <Stack gap="md">
        <Select
          label="Role"
          data={roleIds}
          value={roleId}
          onChange={(v) => setRoleId(v ?? member?.role_id ?? '')}
          allowDeselect={false}
        />
        <Group justify="space-between">
          <Button
            color="red"
            variant="light"
            loading={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            Remove
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}

export function UsersPanel() {
  const { data: members = [], isPending } = useQuery(
    organisationMembersQueryOptions(),
  )
  const { data: roles = [] } = useQuery(rolesQueryOptions())
  const roleById = new Map(roles.map((role) => [role.id, role.name]))
  const roleIds = roles.map((r) => ({ value: r.id, label: r.name }))
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] =
    useState<OrganisationMemberPublic | null>(null)

  if (isPending) return <LoadingPanel label="Loading members..." />

  return (
    <>
      <InviteMemberModal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roleIds={roleIds}
      />
      <EditMemberModal
        opened={editingMember !== null}
        member={editingMember}
        roleIds={roleIds}
        onClose={() => setEditingMember(null)}
      />
      <Panel
        title="Members"
        count={members.length}
        action={
          <Button variant="default" onClick={() => setInviteOpen(true)}>
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
                        onClick={() => setEditingMember(member)}
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
    </>
  )
}
