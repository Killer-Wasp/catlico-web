import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '#/lib/auth/usePermissions'
import {
  createRole,
  deleteRole,
  permissionCatalogQueryOptions,
  rolesQueryOptions,
  settingsKeys,
  updateRole,
} from '#/components/pages/settings/settingsQueries'
import type {
  PermissionInfo,
  PermissionKind,
  RolePublic,
} from '#/components/pages/settings/settingsQueries'
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
  TableBox,
} from '#/components/pages/settings/settingsUi'
import { FormDrawer } from '#/components/ui/FormDrawer'

const KINDS: PermissionKind[] = ['read', 'write', 'delete', 'manage']

type DomainRow = {
  domain: string
  // Permissions grouped by column. A column can hold more than one grant
  // under the same kind (e.g. `manage:users` and `manage:org` under `manage`).
  cells: Record<PermissionKind, PermissionInfo[]>
}

// Group the flat backend catalog into matrix rows, preserving its domain order
// (Investigation, Intel, Automation, Organisation, Access).
function groupByDomain(catalog: PermissionInfo[]): DomainRow[] {
  const order: string[] = []
  const byDomain = new Map<string, DomainRow['cells']>()
  for (const info of catalog) {
    if (!byDomain.has(info.domain)) {
      byDomain.set(info.domain, { read: [], write: [], delete: [], manage: [] })
      order.push(info.domain)
    }
    byDomain.get(info.domain)![info.kind].push(info)
  }
  return order.map((domain) => ({ domain, cells: byDomain.get(domain)! }))
}

// True when the granted set matches the role's stored permissions (order-independent).
function samePermissions(granted: Set<string>, stored: string[]): boolean {
  if (granted.size !== stored.length) return false
  return stored.every((permission) => granted.has(permission))
}

function NewProfileModal({
  opened,
  onClose,
  catalog,
}: {
  opened: boolean
  onClose: () => void
  catalog: PermissionInfo[]
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      // Start new profiles as read-only; admins grant more from the grid.
      createRole({
        name: name.trim(),
        permissions: catalog
          .filter((info) => info.kind === 'read')
          .map((info) => info.key),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.roles() })
      notifySuccess('Profile created')
      setName('')
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create profile'),
  })

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title="New profile"
      submitLabel="Create profile"
      loading={mutation.isPending}
      submitDisabled={!name.trim()}
      onSubmit={() => mutation.mutate()}
    >
      <Stack gap="md">
        <TextInput
          label="Profile name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
      </Stack>
    </FormDrawer>
  )
}

export function ProfilesPanel() {
  const queryClient = useQueryClient()
  const {
    data: roles = [],
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(rolesQueryOptions())
  const { data: catalog = [], isPending: catalogPending } = useQuery(
    permissionCatalogQueryOptions(),
  )
  const { can } = usePermissions()
  const canEdit = can('write:role')
  // Deleting a profile is a distinct grant from editing one (API enforces the split).
  const canDelete = can('delete:role')

  const [profile, setProfile] = useState('')
  const [checkState, setCheckState] = useState<Set<string>>(new Set())
  const [newProfileOpen, setNewProfileOpen] = useState(false)

  const domains = useMemo(() => groupByDomain(catalog), [catalog])

  useEffect(() => {
    if (profile || roles.length === 0) return
    setProfile(roles[0].id)
  }, [profile, roles])

  const activeProfile: RolePublic | undefined =
    roles.find((r) => r.id === profile) ?? roles.at(0)

  useEffect(() => {
    if (!activeProfile) return
    setCheckState(new Set(activeProfile.permissions))
  }, [activeProfile])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activeProfile) throw new Error('Select a profile before saving')
      return updateRole(activeProfile.id, { permissions: [...checkState] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.roles() })
      notifySuccess(`Profile "${activeProfile?.name ?? 'Profile'}" saved`)
    },
    onError: (error) => notifyError(error, 'Unable to save profile'),
  })

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.roles() })
      notifySuccess('Profile deleted')
      setProfile('')
    },
    onError: (error) => notifyError(error, 'Unable to delete profile'),
  })

  if ((isPending || catalogPending) && roles.length === 0) {
    return <LoadingPanel label="Loading profiles..." />
  }

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load profiles. You may not have permission to manage roles."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  if (!activeProfile) {
    return (
      <>
        <NewProfileModal
          opened={newProfileOpen}
          onClose={() => setNewProfileOpen(false)}
          catalog={catalog}
        />
        <Panel
          title="Profiles"
          action={
            canEdit ? (
              <Button variant="default" onClick={() => setNewProfileOpen(true)}>
                + New profile
              </Button>
            ) : undefined
          }
        >
          <Box p={18}>
            <Text c="dimmed">No profiles configured.</Text>
          </Box>
        </Panel>
      </>
    )
  }

  // Built-in roles are view-only: the API 409s on any PATCH/DELETE, so mirror
  // that here — permissions stay visible, but every mutation affordance is off.
  const isBuiltin = activeProfile.is_builtin
  const dirty = !samePermissions(checkState, activeProfile.permissions)

  const toggle = (key: string, checked: boolean) => {
    setCheckState((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return (
    <>
      <NewProfileModal
        opened={newProfileOpen}
        onClose={() => setNewProfileOpen(false)}
        catalog={catalog}
      />
      <Panel
        title="Profiles"
        count={roles.length}
        action={
          canEdit ? (
            <Button variant="default" onClick={() => setNewProfileOpen(true)}>
              + New profile
            </Button>
          ) : undefined
        }
      >
        <Box p={18}>
          <Group gap={8} mb="md" wrap="nowrap">
            <Select
              aria-label="Profile"
              data={roles.map((item) => ({ value: item.id, label: item.name }))}
              value={activeProfile.id}
              onChange={(value) => value && setProfile(value)}
              allowDeselect={false}
              w={260}
            />
            {isBuiltin && (
              <Badge size="sm" color="gray" variant="light" radius="sm">
                Built-in
              </Badge>
            )}
          </Group>
          <Text ff="monospace" fz={11} c="var(--faint)" mb="sm">
            {checkState.size} permission{checkState.size === 1 ? '' : 's'}{' '}
            granted
            {isBuiltin
              ? ' - built-in (view only)'
              : canEdit
                ? ''
                : ' - read only (admin required to edit)'}
          </Text>
          <TableBox>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Domain</Table.Th>
                  {KINDS.map((kind) => (
                    <Table.Th key={kind} ta="center">
                      {kind}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {domains.map(({ domain, cells }) => (
                  <Table.Tr key={domain}>
                    <Table.Td ff="monospace" fw={700}>
                      {domain}
                    </Table.Td>
                    {KINDS.map((kind) => {
                      const infos = cells[kind]
                      return (
                        <Table.Td key={`${domain}-${kind}`} ta="center">
                          {infos.length === 0 ? (
                            <Text c="var(--faint)">.</Text>
                          ) : (
                            <Stack gap={2} align="center">
                              {infos.map((info) => (
                                <Checkbox
                                  key={info.key}
                                  checked={checkState.has(info.key)}
                                  disabled={!canEdit || isBuiltin}
                                  // Only label per-checkbox when a column holds
                                  // more than one grant (e.g. Administration/manage).
                                  label={
                                    infos.length > 1 ? info.label : undefined
                                  }
                                  onChange={(e) =>
                                    toggle(info.key, e.currentTarget.checked)
                                  }
                                  aria-label={info.label}
                                />
                              ))}
                            </Stack>
                          )}
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableBox>
          {!isBuiltin && (canEdit || canDelete) && (
            <Group justify="flex-end" mt="md">
              {canDelete && (
                <Button
                  variant="subtle"
                  color="red"
                  mr="auto"
                  loading={deleteMutation.isPending}
                  onClick={() =>
                    confirmDelete({
                      title: 'Delete profile',
                      message: `Delete the "${activeProfile.name}" profile? Members assigned to it will need a new role.`,
                      onConfirm: () => deleteMutation.mutate(activeProfile.id),
                    })
                  }
                >
                  Delete profile
                </Button>
              )}
              {canEdit && (
                <Button
                  color="orange"
                  loading={saveMutation.isPending}
                  disabled={!dirty}
                  onClick={() => saveMutation.mutate()}
                >
                  Save profile
                </Button>
              )}
            </Group>
          )}
        </Box>
      </Panel>
    </>
  )
}
