import type { Observable } from '#/components/Observables/observables.types'
import { observableEnrichmentsQueryOptions } from '#/components/Observables/observablesQueries'
import type {
  EnrichmentJob,
  EnrichmentOverview,
  EnrichmentVerdict,
  ReportTag,
} from '#/components/Observables/observablesQueries'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { Play, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { DetailChip } from './Pills'
import styles from './styles.module.css'

const VERDICT_RANK: Record<EnrichmentVerdict, number> = {
  info: 0,
  safe: 1,
  suspicious: 2,
  malicious: 3,
}

const VERDICT_COLOR: Record<EnrichmentVerdict, string> = {
  info: 'blue',
  safe: 'green',
  suspicious: 'yellow',
  malicious: 'red',
}

function topVerdict(jobs: EnrichmentJob[]): EnrichmentVerdict | null {
  let best: EnrichmentVerdict | null = null
  for (const job of jobs) {
    if (!job.verdict) continue
    if (best === null || VERDICT_RANK[job.verdict] > VERDICT_RANK[best]) {
      best = job.verdict
    }
  }
  return best
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function sourceLabel(source: string): string {
  if (source.startsWith('#')) return `Case ${source}`
  if (source.startsWith('AL-')) return `Alert ${source.slice(3)}`
  return source
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Group gap={20} align="flex-start" wrap="nowrap">
      <Text ff="monospace" fz={12} c="dimmed" w={120}>
        {label}
      </Text>
      <Text fz={13} fw={600}>
        {children}
      </Text>
    </Group>
  )
}

function EnrichmentCard({
  job,
  tags,
}: {
  job: EnrichmentJob
  tags: ReportTag[]
}) {
  const failed = job.status !== 'success'
  const verdict = job.verdict ?? 'info'
  const color = failed ? 'gray' : VERDICT_COLOR[verdict]
  const stamp = clockTime(job.ended_at ?? job.queued_at)
  const meta = [
    `v${job.connector_version}`,
    stamp,
    job.from_cache ? 'cached' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Paper bg="gray.0" p="sm" radius="md" withBorder={false}>
      <Group justify="space-between" align="flex-start" mb={8}>
        <Group gap={8}>
          <DetailChip color={color}>
            {failed ? job.status.toUpperCase() : verdict.toUpperCase()}
          </DetailChip>
          <Text fw={700} fz={14}>
            {tags.length ? tags[0].namespace : job.connector_name}
          </Text>
        </Group>
        <Text ff="monospace" fz={11} c="dimmed">
          {meta}
        </Text>
      </Group>
      {failed && job.error ? (
        <Text fz={12} c="red.7">
          {job.error}
        </Text>
      ) : tags.length ? (
        <Group gap={6}>
          {tags.map((tag) => (
            <DetailChip
              key={`${tag.namespace}:${tag.predicate}=${tag.value}`}
              color={VERDICT_COLOR[tag.level]}
            >
              {tag.namespace}:{tag.predicate}={tag.value}
            </DetailChip>
          ))}
        </Group>
      ) : (
        <Text fz={12} c="dimmed">
          No taxonomy reported.
        </Text>
      )}
    </Paper>
  )
}

function EnrichmentSection({ observableId }: { observableId: string }) {
  const { data, isPending, isError, isFetching, refetch } = useQuery(
    observableEnrichmentsQueryOptions(observableId),
  )
  const jobs = data?.jobs ?? []
  const tags = data?.tags ?? []
  const runAnalyzers = async () => {
    await refetch()
    notifications.show({
      color: 'blue',
      message: 'Analyzers queued and enrichment refreshed',
    })
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text className={styles.columnHeader}>Enrichment</Text>
        <Button
          size="xs"
          variant="default"
          color="gray"
          leftSection={<Play size={12} fill="currentColor" />}
          loading={isFetching}
          onClick={runAnalyzers}
        >
          Run analyzers
        </Button>
      </Group>

      {isPending ? (
        <Group gap="xs" py="sm">
          <Loader size="xs" />
          <Text fz={13} c="dimmed">
            Loading enrichment…
          </Text>
        </Group>
      ) : isError ? (
        <Text fz={13} c="red.7">
          Couldn’t load enrichment for this observable.
        </Text>
      ) : jobs.length === 0 ? (
        <Text fz={13} c="dimmed">
          No analyzers have run yet — run analyzers to enrich this observable.
        </Text>
      ) : (
        jobs.map((job) => (
          <EnrichmentCard
            key={job.id}
            job={job}
            tags={tags.filter(
              (tag) => tag.connector_name === job.connector_name,
            )}
          />
        ))
      )}
    </Stack>
  )
}

function VerdictBadge({ data }: { data: EnrichmentOverview | undefined }) {
  const verdict = data ? topVerdict(data.jobs) : null
  const label = verdict ? verdict.toUpperCase() : 'OBSERVED'
  const color = verdict ? VERDICT_COLOR[verdict] : 'gray'
  return (
    <Badge color={color} variant="light" mt="sm" radius="sm">
      {label}
    </Badge>
  )
}

export function ObservableDetailDrawer({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable | null
  onToggleIoc?: (observable: Observable) => void
  onMarkSighted?: (observable: Observable) => void
  onClose: () => void
}) {
  if (!observable) return null

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title="Observable detail"
      padding={0}
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
      styles={{
        content: { borderLeft: '4px solid var(--mantine-color-red-6)' },
        header: { display: 'none' },
        body: { height: '100%', padding: 0 },
      }}
    >
      <ObservableDetailContent
        observable={observable}
        onToggleIoc={onToggleIoc}
        onMarkSighted={onMarkSighted}
        onClose={onClose}
      />
    </Drawer>
  )
}

function ObservableDetailContent({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable
  onToggleIoc?: (observable: Observable) => void
  onMarkSighted?: (observable: Observable) => void
  onClose: () => void
}) {
  const { data } = useQuery(observableEnrichmentsQueryOptions(observable.id))
  const ioc = observable.flags.includes('ioc')
  const sighted = observable.flags.includes('sighted')

  return (
    <Stack h="100%" gap={0}>
      <Box p="lg" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text ff="monospace" fz={12} fw={700} c="dimmed" tt="uppercase">
              OBSERVABLE · {observable.type}
            </Text>
            <Text ff="monospace" fz={18} fw={700} mt={8}>
              {observable.value}
            </Text>
            <VerdictBadge data={data} />
          </Box>
          <ActionIcon
            variant="default"
            color="gray"
            aria-label="Close observable detail"
            onClick={onClose}
          >
            <X size={18} />
          </ActionIcon>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto' }}>
        <Stack gap="lg" p="lg">
          <Stack gap="xs">
            <Text className={styles.columnHeader}>Properties</Text>
            <DetailRow label="Type">{observable.type}</DetailRow>
            <DetailRow label="Value">{observable.value}</DetailRow>
            <DetailRow label="IOC">
              <Text component="span" c={ioc ? 'red.7' : 'dimmed'} fw={700}>
                {ioc ? 'yes' : 'no'}
              </Text>
            </DetailRow>
            <DetailRow label="Sighted">{sighted ? 'yes' : 'no'}</DetailRow>
            <DetailRow label="First seen">{observable.added}</DetailRow>
            <DetailRow label="Source">
              {sourceLabel(observable.source)}
            </DetailRow>
          </Stack>

          <EnrichmentSection observableId={observable.id} />
        </Stack>
      </Box>

      <Group
        p="lg"
        gap="sm"
        grow
        style={{ borderTop: '1px solid var(--line-soft)' }}
      >
        {onToggleIoc ? (
          <Button variant="default" onClick={() => onToggleIoc(observable)}>
            Toggle IOC
          </Button>
        ) : null}
        {onMarkSighted ? (
          <Button
            variant="default"
            disabled={sighted}
            onClick={() => onMarkSighted(observable)}
          >
            Mark sighted
          </Button>
        ) : null}
        <Button disabled>Export to MISP</Button>
      </Group>
    </Stack>
  )
}
