import {
  Badge,
  Button,
  Code,
  Group,
  Modal,
  NativeSelect,
  Radio,
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
  organisationsQueryOptions,
  rolesForOrgQueryOptions,
  settingsKeys,
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
} from '#/components/pages/settings/settingsUi'
import { currentUserQueryOptions } from '#/lib/auth/userQueries'
import { requestPasswordReset } from '#/lib/auth/session'

const usersKeyPrefix = settingsKeys.users()

function userName(user: UserPublic) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.email
  )
}

type PasswordMode = 'set' | 'reset'

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
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('set')
  const [password, setPassword] = useState('')
  const [orgId, setOrgId] = useState('')
  const [roleId, setRoleId] = useState('')

  useEffect(() => {
    if (!opened) return
    setStep(1)
    setEmail('')
    setFirstName('')
    setLastName('')
    setIsSuperadmin(false)
    setPasswordMode('set')
    setPassword('')
    setOrgId('')
    setRoleId('')
  }, [opened])

  const { data: organisations = [] } = useQuery(organisationsQueryOptions())
  const { data: roles = [] } = useQuery(
    rolesForOrgQueryOptions(orgId || null),
  )

  // A newly chosen org invalidates the previously picked role.
  useEffect(() => {
    setRoleId('')
  }, [orgId])

  // `attach` decides whether step 2's org membership call runs.
  const mutation = useMutation({
    mutationFn: async (attach: boolean) => {
      const trimmedEmail = email.trim()
      const first = firstName.trim()
      const last = lastName.trim()
      const base = {
        email: trimmedEmail,
        first_name: first,
        last_name: last,
        is_superadmin: isSuperadmin,
      }
      // A "set now" password is sent inline; "reset link" creates a
      // password-less account that we then push through forgot-password.
      const user = await createUser(
        passwordMode === 'set' && password
          ? { ...base, password }
          : base,
      )
      let resetSent = false
      if (passwordMode === 'reset') {
        // Non-fatal: the account exists regardless of the email delivery, so we
        // don't let a failed send roll back creation — but we do report whether
        // it actually went out so the success toast can't over-promise.
        try {
          await requestPasswordReset(trimmedEmail)
          resetSent = true
        } catch {
          /* swallow — reflected in `resetSent` for the toast copy */
        }
      }
      if (attach && orgId && roleId) {
        // Use the definitive id from the freshly-created account rather than the
        // email, so the membership can't hit an email-normalisation mismatch.
        await createOrganisationMember({ user_id: user.id, role_id: roleId }, orgId)
      }
      return { resetSent }
    },
    onSuccess: ({ resetSent }, attach) => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
      if (attach) {
        queryClient.invalidateQueries({
          queryKey: [...settingsKeys.all, 'members'],
        })
      }
      notifySuccess(
        resetSent ? 'Account created — reset link sent' : 'Account created',
      )
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create account'),
  })

  const step1Valid =
    Boolean(email.trim()) &&
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    (passwordMode === 'reset' || Boolean(password))

  const orgData = [
    { value: '', label: 'Select an organisation…' },
    ...organisations.map((org) => ({
      value: org.id,
      label: `${org.name} (${org.id})`,
    })),
  ]
  const roleData = [
    { value: '', label: orgId ? 'Select a role…' : 'Pick an organisation first' },
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
          <Radio.Group
            label="Initial sign-in"
            value={passwordMode}
            onChange={(value) => setPasswordMode(value)}
          >
            <Stack gap="xs" mt="xs">
              <Radio value="set" label="Set a password now" />
              <Radio value="reset" label="Send a reset link" />
            </Stack>
          </Radio.Group>
          {passwordMode === 'set' ? (
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
          ) : (
            <Text size="xs" c="dimmed">
              The account is created without a password; the user sets one via
              the emailed reset link (or the login page's “Forgot password”).
            </Text>
          )}
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
  onClose,
}: {
  user: UserPublic | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setIsActive(user.is_active)
    setIsSuperadmin(user.is_superadmin)
    setNewPassword('')
  }, [user])

  const saveMutation = useMutation({
    mutationFn: () => {
      const patch: Parameters<typeof updateUser>[1] = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: isActive,
        is_superadmin: isSuperadmin,
      }
      // Only send a password when the admin actually typed one (it revokes the
      // target's sessions server-side).
      if (newPassword) patch.password = newPassword
      return updateUser(user!.id, patch)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
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
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            Reset password
          </Text>
          <TextInput
            label="New password"
            type="password"
            placeholder="Leave blank to keep unchanged"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
          />
          <Group>
            <Button
              size="xs"
              variant="default"
              loading={resetLinkMutation.isPending}
              onClick={() => resetLinkMutation.mutate()}
            >
              Send reset link instead
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

export function AllUsersPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    usersQueryOptions(),
  )
  const { data: currentUser } = useQuery(currentUserQueryOptions())
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<UserPublic | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeyPrefix })
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
        header: 'Access',
        cell: ({ row }) =>
          row.original.is_superadmin ? (
            <Badge color="orange" variant="light" radius="xl">
              Superadmin
            </Badge>
          ) : (
            <Text c="dimmed">—</Text>
          ),
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
    [deleteMutation, currentUser?.id],
  )

  if (isPending) return <LoadingPanel label="Loading user accounts..." />

  if (isError) {
    return (
      <ErrorState onRetry={() => refetch()} retrying={isFetching} />
    )
  }

  return (
    <>
      <CreateUserWizard
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
      <EditUserModal user={editing} onClose={() => setEditing(null)} />
      <Panel
        title="All user accounts"
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
    <Panel title="All user accounts">
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
