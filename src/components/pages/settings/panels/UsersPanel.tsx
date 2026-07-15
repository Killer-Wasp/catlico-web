import {
  Badge,
  Button,
  Code,
  Group,
  Modal,
  NativeSelect,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  createOrganisationMember,
  createUser,
  deleteUser,
  organisationMembersQueryOptions,
  organisationsQueryOptions,
  removeOrganisationMember,
  rolesForOrgQueryOptions,
  rolesQueryOptions,
  settingsKeys,
  updateOrganisationMember,
  updateUser,
  usersQueryOptions,
} from '#/components/pages/settings/settingsQueries'
import type { UserPublic } from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  confirmDelete,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
  RoleBadge,
} from '#/components/pages/settings/settingsUi'
import { currentUserQueryOptions } from '#/lib/auth/userQueries'
import { requestPasswordReset } from '#/lib/auth/session'

const usersKeyPrefix = settingsKeys.users()
const membersKeyPrefix = [...settingsKeys.all, 'members']

function userName(user: UserPublic) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.email
  )
}

/**
 * Two-step account wizard. Step 1 creates the GLOBAL account (attached to no
 * org). Step 2 optionally attaches it to an organisation with a role — a
 * separate `POST /organisations/{orgId}/members` call chained after the account
 * exists. Step 2 is skippable (account-only).
 */
function CreateUserWizard({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [roleId, setRoleId] = useState('')

  useEffect(() => {
    if (!opened) return
    setStep(1)
    setEmail('')
    setFirstName('')
    setLastName('')
    setIsSuperadmin(false)
    setOrgId('')
    setRoleId('')
  }, [opened])

  const { data: organisations = [] } = useQuery(organisationsQueryOptions())
  const { data: roles = [] } = useQuery(rolesForOrgQueryOptions(orgId || null))

  // A newly chosen org invalidates the previously picked role.
  useEffect(() => {
    setRoleId('')
  }, [orgId])

  // `attach` decides whether step 2's org membership call runs.
  const mutation = useMutation({
    mutationFn: async (attach: boolean) => {
      // Always password-less: the backend emails the new user a set-password
      // invite on create (no client-side forgot-password call — that would
      // double-send / hit the throttle).
      const user = await createUser({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_superadmin: isSuperadmin,
      })
      if (attach && orgId && roleId) {
        // Use the definitive id from the freshly-created account rather than the
        // email, so the membership can't hit an email-normalisation mismatch.
        await createOrganisationMember(
          { user_id: user.id, role_id: roleId },
          orgId,
        )
      }
    },
    onSuccess: (_data, attach) => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
      if (attach) {
        queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      }
      notifySuccess('Account created — set-password invite sent')
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create account'),
  })

  const step1Valid =
    Boolean(email.trim()) &&
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim())

  const orgData = [
    { value: '', label: 'Select an organisation…' },
    ...organisations.map((org) => ({
      value: org.id,
      label: `${org.name} (${org.id})`,
    })),
  ]
  const roleData = [
    {
      value: '',
      label: orgId ? 'Select a role…' : 'Pick an organisation first',
    },
    ...roles.map((role) => ({ value: role.id, label: role.name })),
  ]

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={step === 1 ? 'New user account' : 'Add to organisation (optional)'}
      size="lg"
    >
      {step === 1 ? (
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Creates a global account, not tied to any organisation. Use the next
            step to add them to one.
          </Text>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <Group grow>
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
          </Group>
          <Switch
            label="Platform superadmin"
            description="Full access to every organisation and all global settings."
            checked={isSuperadmin}
            onChange={(e) => setIsSuperadmin(e.currentTarget.checked)}
          />
          <Text size="xs" c="dimmed">
            The account is created without a password. Catlico emails the user a
            secure link to set their own password (valid for 1 hour).
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="orange"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Optionally add {email.trim() || 'this account'} to an organisation as
            a member. Skip to create the account only.
          </Text>
          <NativeSelect
            label="Organisation"
            data={orgData}
            value={orgId}
            onChange={(e) => setOrgId(e.currentTarget.value)}
          />
          <NativeSelect
            label="Role"
            data={roleData}
            value={roleId}
            disabled={!orgId}
            onChange={(e) => setRoleId(e.currentTarget.value)}
          />
          <Group justify="space-between">
            <Button
              variant="default"
              onClick={() => setStep(1)}
              disabled={mutation.isPending}
            >
              Back
            </Button>
            <Group>
              <Button
                variant="default"
                loading={mutation.isPending && mutation.variables === false}
                onClick={() => mutation.mutate(false)}
              >
                Skip &amp; create
              </Button>
              <Button
                color="orange"
                disabled={!orgId || !roleId}
                loading={mutation.isPending && mutation.variables === true}
                onClick={() => mutation.mutate(true)}
              >
                Create &amp; add to org
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

function EditUserModal({
  user,
  currentRoleId,
  roleOptions,
  onClose,
}: {
  user: UserPublic | null
  // The user's role id in the active organisation, or '' if not a member.
  currentRoleId: string
  roleOptions: { value: string; label: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [roleId, setRoleId] = useState('')

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setIsActive(user.is_active)
    setIsSuperadmin(user.is_superadmin)
    setMustChangePassword(user.must_change_password)
    setRoleId(currentRoleId)
  }, [user, currentRoleId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateUser(user!.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: isActive,
        is_superadmin: isSuperadmin,
        must_change_password: mustChangePassword,
      })
      // Reconcile the account's role in the ACTIVE organisation via the
      // organisation-member mutations: attach when newly assigned, update on a
      // change, remove when cleared.
      if (roleId !== currentRoleId) {
        if (!roleId) {
          await removeOrganisationMember(user!.id)
        } else if (!currentRoleId) {
          await createOrganisationMember({
            user_id: user!.id,
            role_id: roleId,
          })
        } else {
          await updateOrganisationMember(user!.id, { role_id: roleId })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
      queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      notifySuccess('Account updated')
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to update account'),
  })

  const resetLinkMutation = useMutation({
    mutationFn: () => requestPasswordReset(user!.email),
    onSuccess: () => notifySuccess('Reset link sent'),
    onError: (error) => notifyError(error, 'Unable to send reset link'),
  })

  const roleData = [
    { value: '', label: 'No role (not a member of this org)' },
    ...roleOptions,
  ]

  return (
    <Modal
      opened={user !== null}
      onClose={onClose}
      title={user ? `Edit ${user.email}` : 'Edit account'}
      size="lg"
    >
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.currentTarget.value)}
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.currentTarget.value)}
          />
        </Group>
        <Select
          label="Organisation role"
          description="Role in the active organisation. Clear it to remove the account from this org."
          data={roleData}
          value={roleId}
          onChange={(v) => setRoleId(v ?? '')}
          allowDeselect={false}
        />
        <Switch
          label="Active"
          description="Inactive accounts cannot sign in."
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
        <Switch
          label="Platform superadmin"
          checked={isSuperadmin}
          onChange={(e) => setIsSuperadmin(e.currentTarget.checked)}
        />
        <Switch
          label="Require password reset on next login"
          description="The user must choose a fresh password before their next sign-in completes."
          checked={mustChangePassword}
          onChange={(e) => setMustChangePassword(e.currentTarget.checked)}
        />
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Password
          </Text>
          <Text size="xs" c="dimmed">
            Admins can't set a user's password. Send the user a secure link to
            set or reset it themselves.
          </Text>
          <Group>
            <Button
              size="xs"
              variant="default"
              loading={resetLinkMutation.isPending}
              onClick={() => resetLinkMutation.mutate()}
            >
              Send reset link
            </Button>
          </Group>
        </Stack>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

/**
 * The unified Users panel (Admin page): one table of GLOBAL accounts, each shown
 * with its role in the active organisation. Supports create (password-less, with
 * an optional org attach), edit (active / superadmin / force-reset flags, org
 * role assignment, password-reset link) and delete.
 */
export function UsersPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    usersQueryOptions(),
  )
  const { data: members = [] } = useQuery(organisationMembersQueryOptions())
  const { data: roles = [] } = useQuery(rolesQueryOptions())
  const { data: currentUser } = useQuery(currentUserQueryOptions())
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<UserPublic | null>(null)

  // user_id → { roleId, roleName } for the caller's active org.
  const roleNameById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  )
  const memberRoleByUserId = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.role_id])),
    [members],
  )
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  )

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
      queryClient.invalidateQueries({ queryKey: membersKeyPrefix })
      notifySuccess('Account deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete account'),
  })

  const columns = useMemo<ColumnDef<UserPublic>[]>(
    () => [
      {
        id: 'email',
        header: 'Email',
        cell: ({ row }) => <Code>{row.original.email}</Code>,
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => <Text fw={700}>{userName(row.original)}</Text>,
      },
      {
        id: 'active',
        header: 'Status',
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge color="green" variant="light" radius="xl">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light" radius="xl">
              Inactive
            </Badge>
          ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => {
          if (row.original.is_superadmin) {
            return (
              <Badge color="orange" variant="light" radius="xl">
                Superadmin
              </Badge>
            )
          }
          const memberRoleId = memberRoleByUserId.get(row.original.id)
          if (!memberRoleId) return <Text c="dimmed">—</Text>
          return (
            <RoleBadge role={roleNameById.get(memberRoleId) ?? memberRoleId} />
          )
        },
      },
      {
        id: 'lastLogin',
        header: 'Last login',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)" fz={12}>
            {compactDate(row.original.last_login_at)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => {
          // The current user cannot delete their own account (the backend blocks
          // it); hide the action rather than surface a guaranteed error.
          const isSelf = row.original.id === currentUser?.id
          return (
            <Group gap="xs" justify="flex-end">
              <Button
                size="xs"
                variant="default"
                aria-label={`Edit ${row.original.email}`}
                onClick={() => setEditing(row.original)}
              >
                Edit
              </Button>
              {!isSelf && (
                <Button
                  size="xs"
                  variant="default"
                  color="red"
                  aria-label={`Delete ${row.original.email}`}
                  loading={
                    deleteMutation.isPending &&
                    deleteMutation.variables === row.original.id
                  }
                  onClick={() =>
                    confirmDelete({
                      title: 'Delete account',
                      message: `Delete ${userName(row.original)} (${row.original.email})? This removes the global account and all its org memberships.`,
                      confirmLabel: 'Delete account',
                      onConfirm: () => deleteMutation.mutate(row.original.id),
                    })
                  }
                >
                  Delete
                </Button>
              )}
            </Group>
          )
        },
      },
    ],
    [deleteMutation, currentUser?.id, memberRoleByUserId, roleNameById],
  )

  if (isPending) return <LoadingPanel label="Loading user accounts..." />

  if (isError) {
    return <ErrorState onRetry={() => refetch()} retrying={isFetching} />
  }

  return (
    <>
      <CreateUserWizard
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
      <EditUserModal
        user={editing}
        currentRoleId={
          editing ? (memberRoleByUserId.get(editing.id) ?? '') : ''
        }
        roleOptions={roleOptions}
        onClose={() => setEditing(null)}
      />
      <Panel
        title="User accounts"
        count={data.length}
        action={
          <Button variant="default" onClick={() => setWizardOpen(true)}>
            + New user account
          </Button>
        }
      >
        <UsersTable columns={columns} users={data} />
      </Panel>
    </>
  )
}

function ErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <Panel title="User accounts">
      <Stack align="center" gap="sm" p="xl">
        <Text c="red.7">Couldn&apos;t load user accounts.</Text>
        <Button variant="default" loading={retrying} onClick={onRetry}>
          Retry
        </Button>
      </Stack>
    </Panel>
  )
}

function UsersTable({
  columns,
  users,
}: {
  columns: ColumnDef<UserPublic>[]
  users: UserPublic[]
}) {
  const table = useReactTable({
    data: users,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={760}
      ariaLabel="User accounts"
      emptyMessage="No user accounts yet."
    />
  )
}
