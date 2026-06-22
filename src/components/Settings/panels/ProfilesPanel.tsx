import {
  Box,
  Button,
  Checkbox,
  Group,
  Select,
  Table,
  Text,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { profiles, resources, verbs } from '#/components/Settings/settingsData'
import { rolesQueryOptions } from '#/components/Settings/settingsQueries'
import type { RolePublic } from '#/components/Settings/settingsQueries'
import {
  LoadingPanel,
  notify,
  Panel,
  TableBox,
} from '#/components/Settings/settingsUi'

export function ProfilesPanel() {
  const { data: backendRoles = [], isPending } = useQuery(rolesQueryOptions())
  const roleProfiles =
    backendRoles.length > 0
      ? backendRoles
      : profiles.map(
          (item) =>
            ({
              id: item.name,
              name: item.name,
              permissions: Array.from({ length: item.permissions }, (_, i) =>
                String(i),
              ),
              created_at: '',
            }) satisfies RolePublic,
        )
  const [profile, setProfile] = useState('')

  useEffect(() => {
    if (profile || roleProfiles.length === 0) return
    setProfile(roleProfiles[0].name)
  }, [profile, roleProfiles])

  const activeProfile =
    roleProfiles.find((item) => item.name === profile) ?? roleProfiles[0]

  if (isPending && backendRoles.length === 0) {
    return <LoadingPanel label="Loading profiles..." />
  }

  return (
    <Panel
      title="Profiles"
      count={roleProfiles.length}
      action={
        <Button
          variant="default"
          onClick={() => notify('New profile workflow opened')}
        >
          + New profile
        </Button>
      }
    >
      <Box p={18}>
        <Group gap={8} mb="md">
          {roleProfiles.map((item) => (
            <Button
              key={item.name}
              variant={item.name === profile ? 'light' : 'default'}
              color={item.name === profile ? 'orange' : 'gray'}
              size="xs"
              onClick={() => setProfile(item.name)}
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
                  {verbs.map((verb) => (
                    <Table.Td key={`${resource}-${verb}`} ta="center">
                      {(allowed as readonly string[]).includes(verb) ? (
                        <Checkbox
                          defaultChecked={
                            verb === 'read' ||
                            (profile !== 'read-only' &&
                              ['create', 'update'].includes(verb))
                          }
                          aria-label={`${profile} ${verb} ${resource}`}
                        />
                      ) : (
                        <Text c="var(--faint)">.</Text>
                      )}
                    </Table.Td>
                  ))}
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
            onClick={() => notify(`Profile ${profile} saved`)}
          >
            Save profile
          </Button>
        </Group>
      </Box>
    </Panel>
  )
}
