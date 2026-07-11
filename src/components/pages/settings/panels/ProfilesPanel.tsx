import {
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  grantablePermissions,
  permissionGroups,
  permissionVerbs,
} from '#/components/pages/settings/settingsData'
import {
  createRole,
  deleteRole,
  rolesQueryOptions,
  settingsKeys,
  updateRole,
} from '#/components/pages/settings/settingsQueries'
import type { RolePublic } from '#/components/pages/settings/settingsQueries'
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
  TableBox,
} from '#/components/pages/settings/settingsUi'

// True when the granted set matches the role's stored permissions (order-independent).
function samePermissions(granted: Set<string>, stored: string[]): boolean {
  if (granted.size !== stored.length) return false
  return stored.every((permission) => granted.has(permission))
}

function NewProfileModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      // Start new profiles as read-only; admins grant more from the grid.
      createRole({
        name: name.trim(),
        permissions: grantablePermissions.filter((p) => p.startsWith('read:')),
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
    <Modal opened={opened} onClose={onClose} title="New profile">
      <Stack gap="md">
        <TextInput
          label="Profile name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            Create profile
          </Button>
        </Group>
      </Stack>
    </Modal>
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
  const [profile, setProfile] = useState('')
  const [checkState, setCheckState] = useState<Set<string>>(new Set())
  const [newProfileOpen, setNewProfileOpen] = useState(false)

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

  if (isPending && roles.length === 0) {
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
        />
        <Panel
          title="Profiles"
          action={
            <Button variant="default" onClick={() => setNewProfileOpen(true)}>
              + New profile
            </Button>
          }
        >
          <Box p={18}>
            <Text c="dimmed">No profiles configured.</Text>
          </Box>
        </Panel>
      </>
    )
  }

  const dirty = !samePermissions(checkState, activeProfile.permissions)

  return (
    <>
      <NewProfileModal
        opened={newProfileOpen}
        onClose={() => setNewProfileOpen(false)}
      />
      <Panel
        title="Profiles"
        count={roles.length}
        action={
          <Button variant="default" onClick={() => setNewProfileOpen(true)}>
            + New profile
          </Button>
        }
      >
        <Box p={18}>
          <Group gap={8} mb="md">
            {roles.map((item) => (
              <Button
                key={item.id}
                variant={item.id === profile ? 'light' : 'default'}
                color={item.id === profile ? 'orange' : 'gray'}
                size="xs"
                onClick={() => setProfile(item.id)}
              >
                {item.name}
              </Button>
            ))}
          </Group>
          <Text ff="monospace" fz={11} c="var(--faint)" mb="sm">
            backend role - {checkState.size} granted permission
            {checkState.size === 1 ? '' : 's'}
          </Text>
          <TableBox>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Domain</Table.Th>
                  {permissionVerbs.map((verb) => (
                    <Table.Th key={verb} ta="center">
                      {verb}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {permissionGroups.map((group) => (
                  <Table.Tr key={group.domain}>
                    <Table.Td>
                      <Text ff="monospace" fw={700}>
                        {group.domain}
                      </Text>
                      <Text fz={11} c="var(--faint)">
                        {group.description}
                      </Text>
                    </Table.Td>
                    {permissionVerbs.map((verb) => {
                      const cell = group.cells.find((c) => c.verb === verb)
                      if (!cell) {
                        return (
                          <Table.Td key={`${group.domain}-${verb}`} ta="center">
                            <Text c="var(--faint)">.</Text>
                          </Table.Td>
                        )
                      }
                      const isChecked = checkState.has(cell.permission)
                      return (
                        <Table.Td key={`${group.domain}-${verb}`} ta="center">
                          <Checkbox
                            checked={isChecked}
                            onChange={(e) => {
                              const { checked } = e.currentTarget
                              setCheckState((prev) => {
                                const next = new Set(prev)
                                if (checked) next.add(cell.permission)
                                else next.delete(cell.permission)
                                return next
                              })
                            }}
                            aria-label={`${activeProfile.name} ${cell.permission}`}
                          />
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableBox>
          <Group justify="flex-end" mt="md">
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
            <Button
              color="orange"
              loading={saveMutation.isPending}
              disabled={!dirty}
              onClick={() => saveMutation.mutate()}
            >
              Save profile
            </Button>
          </Group>
        </Box>
      </Panel>
    </>
  )
}
