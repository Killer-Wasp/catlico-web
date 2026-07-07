import {
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { resources, verbs } from '#/components/pages/settings/settingsData'
import {
  createRole,
  rolesQueryOptions,
  settingsKeys,
  updateRole,
} from '#/components/pages/settings/settingsQueries'
import type { RolePublic } from '#/components/pages/settings/settingsQueries'
import {
  LoadingPanel,
  Panel,
  TableBox,
} from '#/components/pages/settings/settingsUi'

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
    mutationFn: () => {
      const basePerms = resources
        .filter(([, perms]) => (perms as readonly string[]).includes('read'))
        .map(([resource]) => `read:${resource.toLowerCase().replace(/\s+/g, '-')}`)
      return createRole({ name: name.trim(), permissions: basePerms })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Profile created' })
      setName('')
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to create profile',
      }),
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
  const { data: roles = [], isPending } = useQuery(rolesQueryOptions())
  const [profile, setProfile] = useState('')
  const [checkState, setCheckState] = useState<Set<string>>(new Set())
  const [newProfileOpen, setNewProfileOpen] = useState(false)

  const roleProfiles: RolePublic[] = roles

  useEffect(() => {
    if (profile || roleProfiles.length === 0) return
    setProfile(roleProfiles[0].id)
  }, [profile, roleProfiles])

  const activeProfile = roleProfiles.find((r) => r.id === profile) ?? roleProfiles.at(0)

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
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({
        color: 'green',
        message: `Profile "${activeProfile?.name ?? 'Profile'}" saved`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to save profile',
      }),
  })

  if (isPending && roleProfiles.length === 0) {
    return <LoadingPanel label="Loading profiles..." />
  }

  if (!activeProfile) {
    return (
      <Panel title="Profiles">
        <Box p={18}>
          <Text c="dimmed">No profiles configured.</Text>
        </Box>
      </Panel>
    )
  }

  return (
    <>
      <NewProfileModal
        opened={newProfileOpen}
        onClose={() => setNewProfileOpen(false)}
      />
      <Panel
        title="Profiles"
        count={roleProfiles.length}
        action={
          <Button
            variant="default"
            onClick={() => setNewProfileOpen(true)}
          >
            + New profile
          </Button>
        }
      >
        <Box p={18}>
          <Group gap={8} mb="md">
            {roleProfiles.map((item) => (
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
            backend role - {activeProfile.permissions.length} effective
            permissions
          </Text>
          <TableBox>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Resource</Table.Th>
                  {verbs.map((verb) => (
                    <Table.Th key={verb} ta="center">
                      {verb}
                    </Table.Th>
                  ))}
                  <Table.Th>scope</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {resources.map(([resource, allowed]) => (
                  <Table.Tr key={resource}>
                    <Table.Td ff="monospace" fw={700}>
                      {resource}
                    </Table.Td>
                    {verbs.map((verb) => {
                      const permKey = `${verb}:${resource.toLowerCase().replace(/\s+/g, '-')}`
                      const isRelevant = (allowed as readonly string[]).includes(verb)
                      const isChecked = checkState.has(permKey)

                      return (
                        <Table.Td key={`${resource}-${verb}`} ta="center">
                          {isRelevant ? (
                            <Checkbox
                              checked={isChecked}
                              onChange={(e) => {
                                setCheckState((prev) => {
                                  const next = new Set(prev)
                                  if (e.currentTarget.checked) {
                                    next.add(permKey)
                                  } else {
                                    next.delete(permKey)
                                  }
                                  return next
                                })
                              }}
                              aria-label={`${activeProfile.name} ${verb} ${resource}`}
                            />
                          ) : (
                            <Text c="var(--faint)">.</Text>
                          )}
                        </Table.Td>
                      )
                    })}
                    <Table.Td>
                      {resource === 'Cases' || resource === 'Tasks' ? (
                        <Select
                          data={['any', 'own']}
                          defaultValue="any"
                          allowDeselect={false}
                          size="xs"
                          w={90}
                          aria-label={`${resource} scope`}
                        />
                      ) : (
                        <Text c="var(--faint)">.</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableBox>
          <Group justify="flex-end" mt="md">
            <Text ff="monospace" fz={11} c="var(--faint)" mr="auto">
              admin-plane rows shown in orange - platform rows need the admin org
            </Text>
            <Button
              color="orange"
              loading={saveMutation.isPending}
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
