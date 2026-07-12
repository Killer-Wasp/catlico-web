import {
  ActionIcon,
  Button,
  Code,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { currentUserQueryOptions } from '#/lib/auth/userQueries'
import { usePermissions } from '#/lib/auth/usePermissions'
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
  confirmDelete,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
  RoleBadge,
} from '#/components/pages/settings/settingsUi'

dayjs.extend(relativeTime)

// Members can be refreshed regardless of which org id keys the query.
const membersKeyPrefix = [...settingsKeys.all, 'members']

function memberName(member: OrganisationMemberPublic) {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(' ').trim() ||
    member.email
  )
}

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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')

  // Roles load asynchronously and the modal is always mounted, so seed/repair the
  // default selection once roles arrive rather than at first render (when it's '').
  useEffect(() => {
    if (!roleId && roleIds.length > 0) setRoleId(roleIds[0].value)
  }, [roleIds, roleId])

  const mutation = useMutation({
    mutationFn: () =>
      createOrganisationMember({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_id: roleId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      notifySuccess('Member added')
      setFirstName('')
      setLastName('')
      setEmail('')
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to add member'),
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Add User">
      <Stack gap="md">
        <TextInput
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        <Select
          label="Role"
          data={roleIds}
          value={roleId}
          onChange={(value) => setRoleId(value ?? '')}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={mutation.isPending}
            disabled={
              !firstName.trim() || !lastName.trim() || !email.trim() || !roleId
            }
            onClick={() => mutation.mutate()}
          >
            Add User
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
  const [roleId, setRoleId] = useState('')

  // The modal is always mounted; sync the selected role whenever the target
  // member changes, otherwise the Select stays on its first-render '' value and
  // Save would send an empty role_id (rejected by the API's uuid validation).
  useEffect(() => {
    setRoleId(member?.role_id ?? '')
  }, [member])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrganisationMember(member!.user_id, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      notifySuccess('Member role updated')
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to update member'),
  })

  const unchanged = roleId === (member?.role_id ?? '')

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
          onChange={(v) => setRoleId(v ?? '')}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={saveMutation.isPending}
            disabled={!roleId || unchanged}
            onClick={() => saveMutation.mutate()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function UsersPanel() {
  const queryClient = useQueryClient()
  const { data: members = [], isPending } = useQuery(
    organisationMembersQueryOptions(),
  )
  const { data: roles = [] } = useQuery(rolesQueryOptions())
  const { data: currentUser } = useQuery(currentUserQueryOptions())
  const { can } = usePermissions()
  const canManage = can('write:user')
  // Removing a member is a distinct grant from editing one (API enforces the split).
  const canRemove = can('delete:user')
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  )
  const roleIds = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  )
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] =
    useState<OrganisationMemberPublic | null>(null)

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeOrganisationMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      notifySuccess('Member removed')
    },
    onError: (error) => notifyError(error, 'Unable to remove member'),
  })

  const confirmRemove = (member: OrganisationMemberPublic) =>
    confirmDelete({
      title: 'Remove member',
      message: `Remove ${memberName(member)} from this organisation?`,
      confirmLabel: 'Remove',
      onConfirm: () => removeMutation.mutate(member.user_id),
    })

  const columns = useMemo<ColumnDef<OrganisationMemberPublic>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => <Text fw={700}>{memberName(row.original)}</Text>,
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
        id: 'joined',
        header: 'Joined',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)" fz={12}>
            {dayjs(row.original.created_at).fromNow()}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => {
          if (!canManage && !canRemove) return null
          const isSelf = row.original.user_id === currentUser?.id
          return (
            <Menu position="bottom-end" withinPortal withArrow shadow="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Member actions for ${memberName(row.original)}`}
                >
                  <EllipsisVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canManage && (
                  <Menu.Item
                    leftSection={<Pencil size={14} />}
                    onClick={() => setEditingMember(row.original)}
                  >
                    Edit
                  </Menu.Item>
                )}
                {canRemove && (
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    disabled={isSelf}
                    onClick={() => confirmRemove(row.original)}
                  >
                    {isSelf ? 'Remove (that’s you)' : 'Remove'}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )
        },
      },
    ],
    [roleById, canManage, canRemove, currentUser?.id],
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
          canManage ? (
            <Button variant="default" onClick={() => setInviteOpen(true)}>
              Add User
            </Button>
          ) : undefined
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
