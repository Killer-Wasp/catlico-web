import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  createOrganisation,
  createOrganisationLink,
  deleteOrganisation,
  deleteOrganisationLink,
  fetchOrganisationLinks,
  organisationProfileQueryOptions,
  organisationsQueryOptions,
  settingsKeys,
  updateOrganisationProfile,
} from '#/components/pages/settings/settingsQueries'
import type {
  OrganisationLinkPublic,
  OrganisationPublic,
} from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  Panel,
  TableBox,
  toOrgShortName,
} from '#/components/pages/settings/settingsUi'

export function OrganisationsPanel() {
  const queryClient = useQueryClient()
  const { data: activeOrg } = useQuery(organisationProfileQueryOptions())
  const { data: backendOrgs, isError } = useQuery(organisationsQueryOptions())
  const organisations = backendOrgs ?? (activeOrg ? [activeOrg] : [])
  const [createOpened, setCreateOpened] = useState(false)
  const [newName, setNewName] = useState('')
  const [newId, setNewId] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [managedOrg, setManagedOrg] = useState<OrganisationPublic | null>(null)
  const [managedName, setManagedName] = useState('')
  const [managedDescription, setManagedDescription] = useState('')

  useEffect(() => {
    if (!managedOrg) return
    setManagedName(managedOrg.name)
    setManagedDescription(managedOrg.description)
  }, [managedOrg])

  const closeCreate = () => {
    setCreateOpened(false)
    setNewName('')
    setNewId('')
    setNewDescription('')
  }

  const createMutation = useMutation({
    mutationFn: createOrganisation,
    onSuccess: (created) => {
      queryClient.setQueryData(settingsKeys.organisation(created.id), created)
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.organisations(),
      })
      notifications.show({
        color: 'green',
        message: 'Organisation created',
      })
      closeCreate()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create organisation',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!managedOrg) throw new Error('No organisation selected')
      return updateOrganisationProfile(
        {
          name: managedName,
          description: managedDescription,
        },
        managedOrg.id,
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.organisation(updated.id), updated)
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.organisations(),
      })
      setManagedOrg(updated)
      notifications.show({
        color: 'green',
        message: 'Organisation saved',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save organisation',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!managedOrg) throw new Error('No organisation selected')
      return deleteOrganisation(managedOrg.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      setManagedOrg(null)
      notifications.show({
        color: 'green',
        message: 'Organisation deleted',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to delete organisation',
      }),
  })

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkToOrg, setLinkToOrg] = useState('')

  const { data: links = [] } = useQuery({
    queryKey: settingsKeys.links(activeOrg?.id ?? ''),
    queryFn: () =>
      activeOrg ? fetchOrganisationLinks(activeOrg.id) : Promise.resolve([]),
    enabled: !!activeOrg,
  })

  const linkCreateMutation = useMutation({
    mutationFn: () =>
      createOrganisationLink({ to_org_id: linkToOrg }, activeOrg!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Link created' })
      setLinkModalOpen(false)
      setLinkToOrg('')
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to create link',
      }),
  })

  const linkDeleteMutation = useMutation({
    mutationFn: (toOrgId: string) =>
      deleteOrganisationLink(toOrgId, activeOrg!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ message: 'Link removed' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to remove link',
      }),
  })

  const createDisabled = !newName.trim() || !newId.trim()
  const manageDisabled = !managedName.trim() || !managedOrg

  return (
    <Stack gap="md">
      {createOpened && (
        <Paper
          withBorder
          radius="md"
          p="md"
          role="dialog"
          aria-label="New organisation"
        >
          <Title order={3} fz={15} mb="sm">
            New organisation
          </Title>
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              createMutation.mutate({
                id: newId.trim(),
                name: newName.trim(),
                description: newDescription.trim(),
              })
            }}
          >
            <Stack gap="sm">
              <TextInput
                label="New organisation name"
                value={newName}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setNewName(value)
                  if (!newId) setNewId(toOrgShortName(value))
                }}
              />
              <TextInput
                label="New organisation short name"
                value={newId}
                onChange={(event) =>
                  setNewId(toOrgShortName(event.currentTarget.value))
                }
                styles={{ input: { fontFamily: 'monospace' } }}
              />
              <Textarea
                label="New organisation description"
                value={newDescription}
                minRows={2}
                onChange={(event) =>
                  setNewDescription(event.currentTarget.value)
                }
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button
                  color="orange"
                  type="submit"
                  disabled={createDisabled}
                  loading={createMutation.isPending}
                >
                  Create organisation
                </Button>
              </Group>
            </Stack>
          </Box>
        </Paper>
      )}

      {managedOrg && (
        <Paper
          withBorder
          radius="md"
          p="md"
          role="dialog"
          aria-label="Manage organisation"
        >
          <Title order={3} fz={15} mb="sm">
            Manage organisation
          </Title>
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              updateMutation.mutate()
            }}
          >
            <Stack gap="sm">
              <TextInput
                label="Manage organisation name"
                value={managedName}
                onChange={(event) => setManagedName(event.currentTarget.value)}
              />
              <TextInput
                label="Manage organisation short name"
                value={managedOrg.id}
                readOnly
                styles={{ input: { fontFamily: 'monospace' } }}
              />
              <Textarea
                label="Manage organisation description"
                value={managedDescription}
                minRows={2}
                onChange={(event) =>
                  setManagedDescription(event.currentTarget.value)
                }
              />
              <Group justify="space-between" mt="xs">
                <Button
                  type="button"
                  color="red"
                  variant="light"
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete organisation
                </Button>
                <Group>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setManagedOrg(null)}
                  >
                    Close
                  </Button>
                  <Button
                    color="orange"
                    type="submit"
                    disabled={manageDisabled}
                    loading={updateMutation.isPending}
                  >
                    Save organisation
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Box>
        </Paper>
      )}

      <Panel
        title="Organisations"
        count={organisations.length}
        action={
          <Button variant="default" onClick={() => setCreateOpened(true)}>
            + New organisation
          </Button>
        }
      >
        {isError && (
          <Text c="dimmed" fz={12} px={18} pt={12}>
            Showing the active organisation. Full organisation management
            requires platform administrator access.
          </Text>
        )}
        <TableBox>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Organisation</Table.Th>
                <Table.Th>Short name</Table.Th>
                <Table.Th>Members</Table.Th>
                <Table.Th>Cases</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organisations.map((org) => (
                <Table.Tr key={org.id}>
                  <Table.Td>
                    <Text fw={700}>{org.name}</Text>
                    <Text fz={12} c="var(--muted)">
                      {org.description || 'No description'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Code>{org.id}</Code>
                  </Table.Td>
                  <Table.Td ff="monospace">-</Table.Td>
                  <Table.Td ff="monospace">-</Table.Td>
                  <Table.Td ff="monospace" c="var(--faint)">
                    {compactDate(org.created_at)}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => setManagedOrg(org)}
                    >
                      Manage
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableBox>
      </Panel>

      <Panel title="Organisation links" count={`${links.length} links`}>
        <Group justify="flex-end" p={12}>
          <Button
            size="xs"
            variant="default"
            onClick={() => setLinkModalOpen(true)}
            disabled={!activeOrg}
          >
            + Add link
          </Button>
        </Group>
        <Stack gap={8} px={18} pb={18}>
          {links.map((link: OrganisationLinkPublic) => (
            <Group key={`${link.from_org_id}-${link.to_org_id}`} gap="sm">
              <Text fz={13}>{link.from_org_id}</Text>
              <Text ff="monospace" c="orange.7">
                &rarr;
              </Text>
              <Text fz={13} flex={1}>
                {link.to_org_id}
              </Text>
              <Badge
                variant="light"
                color="green"
                radius="xl"
                ff="monospace"
                size="sm"
              >
                CAN SHARE
              </Badge>
              <Button
                size="xs"
                variant="default"
                color="red"
                onClick={() => linkDeleteMutation.mutate(link.to_org_id)}
              >
                Remove
              </Button>
            </Group>
          ))}
          {links.length === 0 && (
            <Text c="dimmed" fz={13}>
              No organisation links configured.
            </Text>
          )}
        </Stack>
      </Panel>

      <Modal
        opened={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Add organisation link"
      >
        <Stack gap="md">
          <Select
            label="Target organisation"
            data={organisations
              .filter((o) => o.id !== activeOrg?.id)
              .map((o) => ({ value: o.id, label: `${o.name} (${o.id})` }))}
            value={linkToOrg}
            onChange={(v) => setLinkToOrg(v ?? '')}
            searchable
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setLinkModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              loading={linkCreateMutation.isPending}
              disabled={!linkToOrg}
              onClick={() => linkCreateMutation.mutate()}
            >
              Add link
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
