import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  createFreetag,
  deleteTag,
  settingsKeys,
  tagsQueryOptions,
} from '#/components/pages/settings/settingsQueries'
import type { TagPublic } from '#/components/pages/settings/settingsQueries'
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  Panel,
} from '#/components/pages/settings/settingsUi'
import { usePermissions } from '#/lib/auth/usePermissions'

interface NamespaceGroup {
  namespace: string
  tags: TagPublic[]
  predicateCount: number
}

export function TaxonomiesPanel() {
  const queryClient = useQueryClient()
  // Tag deletion is platform-admin only (SuperAdminUser on the API).
  const { isSuperadmin } = usePermissions()
  const {
    data: allTags = [],
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(tagsQueryOptions())

  const deleteMutation = useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.tags(undefined) })
      notifications.show({ color: 'teal', message: 'Tag deleted' })
    },
    onError: () =>
      notifications.show({ color: 'red', message: 'Failed to delete tag' }),
  })

  // --- add freetag (superadmin-only, matching the API guard) ---
  const [addOpen, setAddOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const createMutation = useMutation({
    mutationFn: (predicate: string) => createFreetag(predicate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.tags(undefined) })
      notifications.show({ color: 'teal', message: 'Freetag added' })
      setNewTag('')
      setAddOpen(false)
    },
    onError: (err) =>
      // The API 409s on a duplicate; surface it inline rather than a toast.
      setAddError(
        err instanceof Error && /409|exists/i.test(err.message)
          ? 'That tag already exists.'
          : 'Failed to add tag.',
      ),
  })
  const submitNewTag = () => {
    const value = newTag.trim()
    if (!value) {
      setAddError('Enter a tag name.')
      return
    }
    // A freetag has no namespace/value — ':' or '=' would make it a taxonomy tag.
    if (value.includes(':') || value.includes('=')) {
      setAddError('Freetags can’t contain “:” or “=” (those are taxonomy tags).')
      return
    }
    setAddError(null)
    createMutation.mutate(value)
  }

  const namespaces = useMemo<NamespaceGroup[]>(() => {
    const map = new Map<string, TagPublic[]>()
    for (const tag of allTags) {
      if (!tag.namespace) continue
      const list = map.get(tag.namespace) ?? []
      list.push(tag)
      map.set(tag.namespace, list)
    }
    return [...map.entries()]
      .map(([namespace, tags]) => ({
        namespace,
        tags,
        predicateCount: new Set(tags.map((t) => t.predicate)).size,
      }))
      .sort((a, b) => a.namespace.localeCompare(b.namespace))
  }, [allTags])

  const freetags = useMemo(() => allTags.filter((t) => !t.namespace), [allTags])

  if (isPending) return <LoadingPanel label="Loading tags..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load taxonomies."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <Stack gap="md">
      <Panel title="Taxonomies" count={`${namespaces.length} namespaces`}>
        <Stack gap={0} p={18} pt={6} pb={6}>
          {namespaces.map(
            ({ namespace, tags, predicateCount }: NamespaceGroup) => (
              <Group
                key={namespace}
                py={12}
                style={{ borderBottom: '1px solid var(--line-soft)' }}
              >
                <Box flex={1}>
                  <Text ff="monospace" fz={13} fw={700}>
                    {namespace}
                  </Text>
                  <Text fz={12} c="var(--muted)">
                    {predicateCount} predicate{predicateCount === 1 ? '' : 's'}{' '}
                    · {tags.length} tag{tags.length === 1 ? '' : 's'}
                  </Text>
                </Box>
                <Badge
                  variant="default"
                  color="gray"
                  radius="xl"
                  ff="monospace"
                >
                  {tags.length}
                </Badge>
              </Group>
            ),
          )}
          {namespaces.length === 0 && (
            <Text c="dimmed" fz={13} py={12}>
              No taxonomy namespaces found.
            </Text>
          )}
        </Stack>
      </Panel>

      <Panel title="Org freetags" count={freetags.length}>
        <Group gap={6} p={18}>
          {freetags.map((tag: TagPublic) => (
            <Badge
              key={tag.id}
              variant="default"
              color="gray"
              ff="monospace"
              rightSection={
                isSuperadmin ? (
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    color="gray"
                    aria-label={`Delete tag ${tag.tag}`}
                    loading={
                      deleteMutation.isPending &&
                      deleteMutation.variables === tag.id
                    }
                    onClick={() =>
                      confirmDelete({
                        title: 'Delete tag',
                        message: `Delete the freetag "${tag.tag}"? It will be removed from every entity using it.`,
                        onConfirm: () => deleteMutation.mutate(tag.id),
                      })
                    }
                  >
                    <X size={12} />
                  </ActionIcon>
                ) : undefined
              }
            >
              {tag.tag}
            </Badge>
          ))}
          {isSuperadmin ? (
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                setNewTag('')
                setAddError(null)
                setAddOpen(true)
              }}
            >
              + add
            </Button>
          ) : (
            freetags.length === 0 && (
              <Text c="dimmed" fz="sm">
                No freetags yet. Add them on cases, alerts, or observables.
              </Text>
            )
          )}
        </Group>
      </Panel>

      <Modal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add freetag"
      >
        <Stack gap="md">
          <TextInput
            data-autofocus
            label="Tag name"
            placeholder="e.g. phishing"
            value={newTag}
            error={addError}
            onChange={(e) => {
              setNewTag(e.currentTarget.value)
              if (addError) setAddError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submitNewTag()}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewTag} loading={createMutation.isPending}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
