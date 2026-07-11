import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { tagsQueryOptions } from '#/components/pages/settings/settingsQueries'
import type { TagPublic } from '#/components/pages/settings/settingsQueries'
import {
  ErrorPanel,
  LoadingPanel,
  notify,
  Panel,
} from '#/components/pages/settings/settingsUi'

interface NamespaceGroup {
  namespace: string
  tags: TagPublic[]
  predicateCount: number
}

export function TaxonomiesPanel() {
  const {
    data: allTags = [],
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(tagsQueryOptions())

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
      <Panel
        title="Taxonomies"
        count={`${namespaces.length} namespaces`}
        action={
          <Button
            variant="default"
            onClick={() => notify('MISP taxonomy import not yet implemented.')}
          >
            Import MISP taxonomy
          </Button>
        }
      >
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
            <Badge key={tag.id} variant="default" color="gray" ff="monospace">
              {tag.tag}
            </Badge>
          ))}
          <Button
            size="xs"
            variant="default"
            onClick={() =>
              notify(
                'Freetags are managed per-entity. Add them on cases, alerts, or observables.',
              )
            }
          >
            + add
          </Button>
        </Group>
      </Panel>
    </Stack>
  )
}
