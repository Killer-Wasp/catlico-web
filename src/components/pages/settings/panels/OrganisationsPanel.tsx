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
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
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
  confirmDelete,
  notifyError,
  notifySuccess,
  Panel,
  toOrgShortName,
} from '#/components/pages/settings/settingsUi'
import { usePermissions } from '#/lib/auth/usePermissions'

export function OrganisationsPanel() {
  const queryClient = useQueryClient()
  // Create/delete are platform-admin only (SuperAdminUser on the API); org-scoped
  // edits and links only need write:organisation, so they stay available.
  const { isSuperadmin } = usePermissions()
  const { data: activeOrg } = useQuery(organisationProfileQueryOptions())
  const { data: backendOrgs, isError } = useQuery(organisationsQueryOptions())
  const organisations = backendOrgs ?? (activeOrg ? [activeOrg] : [])
  const [createOpened, setCreateOpened] = useState(false)
  const [newName, setNewName] = useState('')
  const [newId, setNewId] = useState('')
  // Stop auto-deriving the ID from the name once the user edits the ID by hand.
  const [idEdited, setIdEdited] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [managedOrg, setManagedOrg] = useState<OrganisationPublic | null>(null)
  const [managedName, setManagedName] = useState('')
  const [managedDescription, setManagedDescription] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  useEffect(() => {
    if (!managedOrg) return
    setManagedName(managedOrg.name)
    setManagedDescription(managedOrg.description)
  }, [managedOrg])

  const closeCreate = () => {
    setCreateOpened(false)
    setNewName('')
    setNewId('')
    setIdEdited(false)
    setNewDescription('')
  }

  const createMutation = useMutation({
    mutationFn: createOrganisation,
    onSuccess: (created) => {
      queryClient.setQueryData(settingsKeys.organisation(created.id), created)
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.organisations(),
      })
      notifySuccess('Organisation created')
      closeCreate()
    },
    onError: (error) => notifyError(error, 'Unable to create organisation'),
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
      notifySuccess('Organisation saved')
    },
    onError: (error) => notifyError(error, 'Unable to save organisation'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!managedOrg) throw new Error('No organisation selected')
      return deleteOrganisation(managedOrg.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.organisations(),
      })
      void queryClient.invalidateQueries({
        queryKey: settingsKeys.accessibleOrganisations(),
      })
      setManagedOrg(null)
      setDeleteConfirmOpen(false)
      setDeleteConfirmName('')
      notifySuccess('Organisation deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete organisation'),
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
    mutationFn: () => {
      if (!activeOrg) throw new Error('No active organisation is selected.')
      return createOrganisationLink({ to_org_id: linkToOrg }, activeOrg.id)
    },
    onSuccess: () => {
      if (activeOrg)
        queryClient.invalidateQueries({
          queryKey: settingsKeys.links(activeOrg.id),
        })
      notifySuccess('Link created')
      setLinkModalOpen(false)
      setLinkToOrg('')
    },
    onError: (error) => notifyError(error, 'Unable to create link'),
  })

  const linkDeleteMutation = useMutation({
    mutationFn: (toOrgId: string) => {
      if (!activeOrg) throw new Error('No active organisation is selected.')
      return deleteOrganisationLink(toOrgId, activeOrg.id)
    },
    onSuccess: () => {
      if (activeOrg)
        queryClient.invalidateQueries({
          queryKey: settingsKeys.links(activeOrg.id),
        })
      notifySuccess('Link removed')
    },
    onError: (error) => notifyError(error, 'Unable to remove link'),
  })

  const createDisabled = !newName.trim() || !newId.trim()
  const manageDisabled = !managedName.trim() || !managedOrg

  const orgColumns = useMemo<ColumnDef<OrganisationPublic>[]>(
    () => [
      {
        id: 'organisation',
        header: 'Organisation',
        cell: ({ row }) => (
          <>
            <Text fw={700}>{row.original.name}</Text>
            <Text fz={12} c="var(--muted)">
              {row.original.description || 'No description'}
            </Text>
          </>
        ),
      },
      {
        id: 'shortName',
        header: 'Short name',
        cell: ({ row }) => <Code>{row.original.id}</Code>,
      },
      {
        id: 'created',
        header: 'Created',
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
            onClick={() => setManagedOrg(row.original)}
          >
            Manage
          </Button>
        ),
      },
    ],
    [],
  )

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
                  if (!idEdited) setNewId(toOrgShortName(value))
                }}
              />
              <TextInput
                label="New Organisation ID"
                value={newId}
                onChange={(event) => {
                  setIdEdited(true)
                  setNewId(toOrgShortName(event.currentTarget.value))
                }}
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
                label="Manage Organisation ID"
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
                {isSuperadmin ? (
                  <Button
                    type="button"
                    color="red"
                    variant="light"
                    loading={deleteMutation.isPending}
                    onClick={() => {
                      setDeleteConfirmName('')
                      setDeleteConfirmOpen(true)
                    }}
                  >
                    Delete organisation
                  </Button>
                ) : (
                  <span />
                )}
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

      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete organisation"
      >
        <Stack gap="md">
          <Text fz={14}>
            Type {managedOrg?.name ?? 'the organisation name'} to confirm
            deletion.
          </Text>
          <TextInput
            label="Organisation name"
            value={deleteConfirmName}
            onChange={(event) =>
              setDeleteConfirmName(event.currentTarget.value)
            }
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              disabled={deleteConfirmName !== managedOrg?.name}
              onClick={() => deleteMutation.mutate()}
            >
              Delete organisation
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Panel
        title="Organisations"
        count={organisations.length}
        action={
          isSuperadmin ? (
            <Button variant="default" onClick={() => setCreateOpened(true)}>
              + New organisation
            </Button>
          ) : undefined
        }
      >
        {isError && (
          <Text c="dimmed" fz={12} px={18} pt={12}>
            Showing the active organisation. Full organisation management
            requires platform administrator access.
          </Text>
        )}
        <OrganisationsTable
          columns={orgColumns}
          organisations={organisations}
        />
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
                loading={
                  linkDeleteMutation.isPending &&
                  linkDeleteMutation.variables === link.to_org_id
                }
                onClick={() =>
                  confirmDelete({
                    title: 'Remove link',
                    message: `Remove the sharing link to ${link.to_org_id}?`,
                    confirmLabel: 'Remove',
                    onConfirm: () => linkDeleteMutation.mutate(link.to_org_id),
                  })
                }
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
            <Button variant="default" onClick={() => setLinkModalOpen(false)}>
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

function OrganisationsTable({
  columns,
  organisations,
}: {
  columns: ColumnDef<OrganisationPublic>[]
  organisations: OrganisationPublic[]
}) {
  const table = useReactTable({
    data: organisations,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={760}
      ariaLabel="Organisations"
      emptyMessage="No organisations found."
    />
  )
}
