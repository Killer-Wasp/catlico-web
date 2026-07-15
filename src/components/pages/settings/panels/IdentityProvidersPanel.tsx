import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  PasswordInput,
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
  createOidcProvider,
  deleteOidcProvider,
  oidcProvidersQueryOptions,
  settingsKeys,
  updateOidcProvider,
} from '#/components/pages/settings/settingsQueries'
import type {
  OidcProviderCreateInput,
  OidcProviderPublic,
  OidcProviderUpdateInput,
} from '#/components/pages/settings/settingsQueries'
import {
  confirmDelete,
  LoadingPanel,
  ErrorPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

const oidcKey = settingsKeys.oidcProviders()

/** Split a whitespace/comma separated scopes string into a clean list. */
function parseScopes(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function SecretBadge({ configured }: { configured: boolean }) {
  return (
    <Badge
      variant="light"
      color={configured ? 'green' : 'gray'}
      radius="xl"
      size="sm"
    >
      {configured ? 'Secret configured' : 'No secret'}
    </Badge>
  )
}

function CreateProviderModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [issuer, setIssuer] = useState('')
  const [clientId, setClientId] = useState('')
  const [defaultOrg, setDefaultOrg] = useState('')
  const [defaultRole, setDefaultRole] = useState('')
  const [scopes, setScopes] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!opened) return
    setSlug('')
    setName('')
    setIssuer('')
    setClientId('')
    setDefaultOrg('')
    setDefaultRole('')
    setScopes('')
    setClientSecret('')
    setEnabled(true)
    setFormError('')
  }, [opened])

  const mutation = useMutation({
    mutationFn: (input: OidcProviderCreateInput) => createOidcProvider(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oidcKey })
      notifySuccess('Identity provider created')
      onClose()
    },
    // The org/role 400 arrives with its `detail` as the error message; show it
    // inline in the still-open form rather than a toast so it reads as a field
    // problem the admin can fix.
    onError: (error) =>
      setFormError(
        error instanceof Error ? error.message : 'Unable to create provider',
      ),
  })

  const valid =
    Boolean(slug.trim()) &&
    Boolean(name.trim()) &&
    Boolean(issuer.trim()) &&
    Boolean(clientId.trim()) &&
    Boolean(defaultOrg.trim()) &&
    Boolean(defaultRole.trim())

  const submit = () => {
    setFormError('')
    const parsedScopes = parseScopes(scopes)
    const input: OidcProviderCreateInput = {
      slug: slug.trim(),
      name: name.trim(),
      issuer: issuer.trim(),
      client_id: clientId.trim(),
      default_org_slug: defaultOrg.trim(),
      default_role_name: defaultRole.trim(),
      enabled,
    }
    if (parsedScopes.length > 0) input.scopes = parsedScopes
    if (clientSecret.trim())
      input.secrets = { client_secret: clientSecret.trim() }
    mutation.mutate(input)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add identity provider" size="lg">
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Configures an OIDC single-sign-on provider. Users signing in through it
          land in the default organisation with the default role.
        </Text>
        {formError && (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        )}
        <Group grow>
          <TextInput
            label="Slug"
            description="Stable identifier used in the login URL."
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Name"
            description="Display name shown on the sign-in button."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
        </Group>
        <TextInput
          label="Issuer"
          description="The provider's OIDC issuer URL."
          placeholder="https://…"
          value={issuer}
          onChange={(e) => setIssuer(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.currentTarget.value)}
          required
        />
        <PasswordInput
          label="Client secret"
          description="Stored write-only — it is never shown again."
          value={clientSecret}
          onChange={(e) => setClientSecret(e.currentTarget.value)}
        />
        <TextInput
          label="Scopes"
          description="Optional, space-separated. Defaults are applied when blank."
          placeholder="openid email profile"
          value={scopes}
          onChange={(e) => setScopes(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput
            label="Default organisation"
            description="Slug of the org new users join."
            value={defaultOrg}
            onChange={(e) => setDefaultOrg(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Default role"
            description="Role name granted in that org."
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.currentTarget.value)}
            required
          />
        </Group>
        <Switch
          label="Enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            disabled={!valid}
            loading={mutation.isPending}
            onClick={submit}
          >
            Create provider
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function EditProviderModal({
  provider,
  onClose,
}: {
  provider: OidcProviderPublic | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [issuer, setIssuer] = useState('')
  const [clientId, setClientId] = useState('')
  const [defaultOrg, setDefaultOrg] = useState('')
  const [defaultRole, setDefaultRole] = useState('')
  const [scopes, setScopes] = useState('')
  const [enabled, setEnabled] = useState(true)
  // The secret is never returned, so there is nothing to prefill. A fresh input
  // is revealed on demand; a submitted value rotates it, and "remove" clears it.
  const [showSecretField, setShowSecretField] = useState(false)
  const [clientSecret, setClientSecret] = useState('')
  const [removeSecret, setRemoveSecret] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!provider) return
    setName(provider.name)
    setIssuer(provider.issuer)
    setClientId(provider.client_id)
    setDefaultOrg(provider.default_org_slug)
    setDefaultRole(provider.default_role_name)
    setScopes(provider.scopes.join(' '))
    setEnabled(provider.enabled)
    setShowSecretField(false)
    setClientSecret('')
    setRemoveSecret(false)
    setFormError('')
  }, [provider])

  const mutation = useMutation({
    mutationFn: (patch: OidcProviderUpdateInput) =>
      updateOidcProvider(provider!.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oidcKey })
      notifySuccess('Identity provider updated')
      onClose()
    },
    onError: (error) =>
      setFormError(
        error instanceof Error ? error.message : 'Unable to update provider',
      ),
  })

  if (!provider) return <Modal opened={false} onClose={onClose} title="" />

  const submit = () => {
    setFormError('')
    // Diff each field against the original so PATCH carries only what changed.
    const patch: OidcProviderUpdateInput = {}
    if (name.trim() !== provider.name) patch.name = name.trim()
    if (issuer.trim() !== provider.issuer) patch.issuer = issuer.trim()
    if (clientId.trim() !== provider.client_id) patch.client_id = clientId.trim()
    if (defaultOrg.trim() !== provider.default_org_slug)
      patch.default_org_slug = defaultOrg.trim()
    if (defaultRole.trim() !== provider.default_role_name)
      patch.default_role_name = defaultRole.trim()
    const parsedScopes = parseScopes(scopes)
    if (!arraysEqual(parsedScopes, provider.scopes)) patch.scopes = parsedScopes
    if (enabled !== provider.enabled) patch.enabled = enabled
    // Removal wins over a typed replacement so the intent to clear is never
    // silently overridden.
    if (removeSecret) {
      patch.secrets = { client_secret: null }
    } else if (showSecretField && clientSecret.trim()) {
      patch.secrets = { client_secret: clientSecret.trim() }
    }

    if (Object.keys(patch).length === 0) {
      notifySuccess('No changes to save')
      onClose()
      return
    }
    mutation.mutate(patch)
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Edit ${provider.name}`}
      size="lg"
    >
      <Stack gap="md">
        {formError && (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        )}
        <Box>
          <Text size="xs" c="dimmed">
            Slug
          </Text>
          <Code>{provider.slug}</Code>
        </Box>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label="Issuer"
          value={issuer}
          onChange={(e) => setIssuer(e.currentTarget.value)}
        />
        <TextInput
          label="Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.currentTarget.value)}
        />
        <TextInput
          label="Scopes"
          description="Space-separated."
          value={scopes}
          onChange={(e) => setScopes(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput
            label="Default organisation"
            value={defaultOrg}
            onChange={(e) => setDefaultOrg(e.currentTarget.value)}
          />
          <TextInput
            label="Default role"
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.currentTarget.value)}
          />
        </Group>

        <Stack gap={6}>
          <Group gap="sm">
            <Text size="sm" fw={600}>
              Client secret
            </Text>
            <SecretBadge configured={provider.has_client_secret} />
          </Group>
          <Text size="xs" c="dimmed">
            The client secret is write-only and never shown. Set a new one to
            replace it, or leave it untouched to keep the stored value.
          </Text>
          {showSecretField ? (
            <PasswordInput
              label="Client secret"
              description="Replaces the stored secret."
              value={clientSecret}
              disabled={removeSecret}
              onChange={(e) => setClientSecret(e.currentTarget.value)}
              autoFocus
            />
          ) : (
            <Button
              variant="default"
              w="fit-content"
              disabled={removeSecret}
              onClick={() => setShowSecretField(true)}
            >
              {provider.has_client_secret ? 'Rotate secret' : 'Set secret'}
            </Button>
          )}
          {provider.has_client_secret && (
            <Checkbox
              label="Remove stored secret"
              checked={removeSecret}
              onChange={(e) => setRemoveSecret(e.currentTarget.checked)}
            />
          )}
        </Stack>

        <Switch
          label="Enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={mutation.isPending}
            onClick={submit}
          >
            Save changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function IdentityProvidersPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    oidcProvidersQueryOptions(),
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<OidcProviderPublic | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteOidcProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oidcKey })
      notifySuccess('Identity provider deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete provider'),
  })

  const columns = useMemo<ColumnDef<OidcProviderPublic>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <Stack gap={2}>
            <Text fw={700}>{row.original.name}</Text>
            <Code>{row.original.slug}</Code>
          </Stack>
        ),
      },
      {
        id: 'issuer',
        header: 'Issuer',
        cell: ({ row }) => (
          <Text ff="monospace" fz={12} c="var(--faint)">
            {row.original.issuer}
          </Text>
        ),
      },
      {
        id: 'client_id',
        header: 'Client ID',
        cell: ({ row }) => (
          <Text ff="monospace" fz={12}>
            {row.original.client_id}
          </Text>
        ),
      },
      {
        id: 'default',
        header: 'Default org / role',
        cell: ({ row }) => (
          <Group gap={6}>
            <Code>{row.original.default_org_slug}</Code>
            <Text c="dimmed">/</Text>
            <Code>{row.original.default_role_name}</Code>
          </Group>
        ),
      },
      {
        id: 'secret',
        header: 'Secret',
        cell: ({ row }) => (
          <SecretBadge configured={row.original.has_client_secret} />
        ),
      },
      {
        id: 'enabled',
        header: 'Status',
        cell: ({ row }) =>
          row.original.enabled ? (
            <Badge color="green" variant="light" radius="xl">
              Enabled
            </Badge>
          ) : (
            <Badge color="gray" variant="light" radius="xl">
              Disabled
            </Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => (
          <Group gap="xs" justify="flex-end">
            <Button
              size="xs"
              variant="default"
              aria-label={`Edit ${row.original.name}`}
              onClick={() => setEditing(row.original)}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="default"
              color="red"
              aria-label={`Delete ${row.original.name}`}
              loading={
                deleteMutation.isPending &&
                deleteMutation.variables === row.original.id
              }
              onClick={() =>
                confirmDelete({
                  title: 'Delete identity provider',
                  message: `Delete the ${row.original.name} (${row.original.slug}) provider? Users can no longer sign in through it.`,
                  confirmLabel: 'Delete provider',
                  onConfirm: () => deleteMutation.mutate(row.original.id),
                })
              }
            >
              Delete
            </Button>
          </Group>
        ),
      },
    ],
    [deleteMutation],
  )

  if (isPending) return <LoadingPanel label="Loading identity providers..." />
  if (isError)
    return (
      <ErrorPanel
        label="Couldn't load identity providers."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )

  return (
    <>
      <CreateProviderModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <EditProviderModal provider={editing} onClose={() => setEditing(null)} />
      <Panel
        title="Identity providers"
        count={data.length}
        action={
          <Button variant="default" onClick={() => setCreateOpen(true)}>
            + Add provider
          </Button>
        }
      >
        <ProvidersTable columns={columns} providers={data} />
      </Panel>
    </>
  )
}

function ProvidersTable({
  columns,
  providers,
}: {
  columns: ColumnDef<OidcProviderPublic>[]
  providers: OidcProviderPublic[]
}) {
  const table = useReactTable({
    data: providers,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={860}
      ariaLabel="Identity providers"
      emptyMessage="No identity providers configured yet."
    />
  )
}
