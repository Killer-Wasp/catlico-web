import {
  Button,
  Code,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  createOrganisationMember,
  organisationMembersQueryOptions,
  removeOrganisationMember,
  rolesQueryOptions,
  settingsKeys,
  updateOrganisationMember,
} from '#/components/pages/settings/settingsQueries'
import type { OrganisationMemberPublic } from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  LoadingPanel,
  Panel,
  RoleBadge,
} from '#/components/pages/settings/settingsUi'

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
    mutationFn: () =>
      createOrganisationMember({ user_id: userId.trim(), role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Member added' })
      setUserId('')
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to add member',
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
        message:
          error instanceof Error ? error.message : 'Unable to update member',
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
        message:
          error instanceof Error ? error.message : 'Unable to remove member',
      }),
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Edit ${member?.email ?? 'member'}`}
    >
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

  const columns = useMemo<ColumnDef<OrganisationMemberPublic>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <Text fw={700}>{row.original.email.split('@')[0]}</Text>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ row }) => <Code>{row.original.email}</Code>,
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <RoleBadge
            role={roleById.get(row.original.role_id) ?? row.original.role_id}
          />
        ),
      },
      {
        id: 'lastActive',
        header: 'Last active',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {compactDate(row.original.created_at)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => (
          <Button
            size="xs"
            variant="default"
            onClick={() => setEditingMember(row.original)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [roleById],
  )

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
        <MembersTable columns={columns} members={members} />
      </Panel>
    </>
  )
}

function MembersTable({
  columns,
  members,
}: {
  columns: ColumnDef<OrganisationMemberPublic>[]
  members: OrganisationMemberPublic[]
}) {
  const table = useReactTable({
    data: members,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={720}
      ariaLabel="Members"
      emptyMessage="No members returned by the backend."
    />
  )
}
