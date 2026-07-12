/**
 * Org-wide ATT&CK coverage: the matrix in heatmap mode, cells shaded by how
 * many org cases observed each technique. Clicking a cell opens a drawer with
 * the technique's description and its linked cases.
 */
import {
  attackCaseStatsQueryOptions,
  attackCatalogQueryOptions,
  techniqueCasesQueryOptions,
} from '#/components/Attack/attackQueries'
import { AttackMatrix } from '#/components/Attack/AttackMatrix'
import { buildMatrix } from '#/components/Attack/buildMatrix'
import {
  Anchor,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

export function AttackMatrixPage() {
  const catalog = useQuery(attackCatalogQueryOptions())
  const stats = useQuery(attackCaseStatsQueryOptions())
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const columns = useMemo(
    () => buildMatrix(catalog.data ?? [], stats.data ?? {}),
    [catalog.data, stats.data],
  )
  const openTechnique = useMemo(
    () => (catalog.data ?? []).find((p) => p.external_id === openId) ?? null,
    [catalog.data, openId],
  )

  if (catalog.isPending || stats.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (catalog.isError || stats.isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="red.7">Couldn't load the ATT&CK matrix.</Text>
        <Button
          variant="default"
          loading={catalog.isFetching || stats.isFetching}
          onClick={() => {
            catalog.refetch()
            stats.refetch()
          }}
        >
          Retry
        </Button>
      </Stack>
    )
  }

  if (columns.length === 0) {
    return (
      <Stack align="center" py="xl" gap="xs">
        <Title order={3}>ATT&CK catalog is empty</Title>
        <Text c="dimmed">
          An org admin can import it from Settings → ATT&CK catalog.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={2}>ATT&CK matrix</Title>
        <TextInput
          aria-label="Filter techniques"
          leftSection={<Search size={14} />}
          placeholder="Filter techniques…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={260}
        />
      </Group>
      <AttackMatrix
        columns={columns}
        mode="heatmap"
        search={search}
        onOpenTechnique={setOpenId}
      />
      <Drawer
        opened={openId != null}
        onClose={() => setOpenId(null)}
        position="right"
        title={
          openTechnique
            ? `${openTechnique.external_id} — ${openTechnique.name}`
            : ''
        }
      >
        {openId ? (
          <TechniqueDetails
            externalId={openId}
            description={openTechnique?.description ?? ''}
            url={openTechnique?.url ?? ''}
          />
        ) : null}
      </Drawer>
    </Stack>
  )
}

function TechniqueDetails({
  externalId,
  description,
  url,
}: {
  externalId: string
  description: string
  url: string
}) {
  const cases = useQuery(techniqueCasesQueryOptions(externalId))
  return (
    <Stack gap="md">
      {url ? (
        <Anchor href={url} target="_blank" rel="noreferrer" fz={13}>
          View on attack.mitre.org
        </Anchor>
      ) : null}
      <Text fz={13} style={{ whiteSpace: 'pre-wrap' }} lineClamp={12}>
        {description}
      </Text>
      <Box>
        <Text fw={700} fz={13} mb={4}>
          Linked cases
        </Text>
        {cases.isPending ? (
          <Loader size="xs" />
        ) : cases.isError ? (
          <Text c="red.7" fz={13}>
            Couldn't load linked cases.
          </Text>
        ) : (cases.data ?? []).length === 0 ? (
          <Text c="dimmed" fz={13}>
            No cases observed this technique.
          </Text>
        ) : (
          <Stack gap={4}>
            {(cases.data ?? []).map((c) => (
              <Anchor
                key={c.id}
                fz={13}
                renderRoot={(props) => (
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: String(c.id) }}
                    {...props}
                  />
                )}
              >
                #{c.id} {c.title}
              </Anchor>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  )
}
