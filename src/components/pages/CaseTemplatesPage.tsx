import type {
  CaseTemplate,
  CaseTemplateFilter,
} from '#/components/Cases/caseTemplates.types'
import {
  filterCaseTemplates,
  getCaseTemplateStats,
  severityTemplateLabel,
  trafficTemplateLabel,
} from '#/components/Cases/caseTemplates'
import {
  caseTemplateKeys,
  caseTemplatesQueryOptions,
  deleteCaseTemplate,
  duplicateCaseTemplate,
  importCaseTemplate,
} from '#/components/Cases/caseTemplatesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, useLocation } from '@tanstack/react-router'
import { ButtonLink } from '#/components/ui/ButtonLink'
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const filterTabs: { value: CaseTemplateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-In' },
  { value: 'custom', label: 'Custom' },
]

function TemplateChip({ children }: { children: ReactNode }) {
  return (
    <Text
      component="span"
      ff="monospace"
      fz={10}
      c="var(--muted)"
      bg="gray.0"
      px={8}
      py={3}
      style={{
        border: '1px solid var(--line-soft)',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Text>
  )
}

function TemplateCard({
  template,
  onDuplicate,
  onDelete,
}: {
  template: CaseTemplate
  onDuplicate: (template: CaseTemplate) => void
  onDelete: (template: CaseTemplate) => void
}) {
  const stats = getCaseTemplateStats(template)
  const visibleTags = template.tags.slice(0, 3)
  const overflowTagCount = template.tags.length - visibleTags.length

  return (
    <Paper
      radius="md"
      p={18}
      shadow="xs"
      style={{
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap">
        <ButtonLink
          to="/case-templates/$templateId"
          params={{ templateId: template.id }}
          variant="transparent"
          color="dark"
          p={0}
          h="auto"
          ta="left"
          fz={16}
          fw={700}
          style={{ whiteSpace: 'normal', lineHeight: 1.25 }}
        >
          {template.name}
        </ButtonLink>
        {template.builtin && (
          <Badge
            variant="outline"
            color="orange"
            radius={4}
            ff="monospace"
            fw={500}
            lts="0.8px"
          >
            Built-In
          </Badge>
        )}
      </Group>

      <Text c="var(--muted)" fz={14} fw={500} lh={1.45} mt={18}>
        {template.description}
      </Text>

      <Group gap={6} mt={16}>
        <TemplateChip>SEV {severityTemplateLabel(template.sev)}</TemplateChip>
        <TemplateChip>TLP {trafficTemplateLabel(template.tlp)}</TemplateChip>
        <TemplateChip>PAP {trafficTemplateLabel(template.pap)}</TemplateChip>
        {visibleTags.map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
        {overflowTagCount > 0 && (
          <TemplateChip>+{overflowTagCount}</TemplateChip>
        )}
      </Group>

      <Group gap={16} mt={16} ff="monospace" fz={12} c="var(--faint)">
        <Text component="span" inherit>
          {stats.tasks} tasks
        </Text>
        {stats.flagged > 0 && (
          <Text component="span" inherit>
            <Text component="span" c="var(--text)" inherit>
              {stats.flagged}
            </Text>{' '}
            flagged
          </Text>
        )}
        <Text component="span" inherit>
          <Text component="span" c="var(--text)" inherit>
            {stats.customFields}
          </Text>{' '}
          custom fields
        </Text>
      </Group>

      <Group
        gap={8}
        mt="auto"
        pt={16}
        wrap="nowrap"
        style={{ borderTop: '1px solid var(--line-soft)' }}
      >
        <Text ff="monospace" fz={11} c="var(--faint)" flex={1}>
          updated {template.updated}
        </Text>
        <ButtonLink
          to="/case-templates/$templateId"
          params={{ templateId: template.id }}
          size="xs"
          variant="default"
        >
          Edit
        </ButtonLink>
        <Button
          size="xs"
          variant="default"
          onClick={() => onDuplicate(template)}
        >
          Duplicate
        </Button>
        <Button size="xs" variant="default" onClick={() => onDelete(template)}>
          Delete
        </Button>
      </Group>
    </Paper>
  )
}

export function CaseTemplatesPage() {
  const [filter, setFilter] = useState<CaseTemplateFilter>('all')
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const importInputRef = useRef<HTMLInputElement>(null)
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    caseTemplatesQueryOptions(),
  )
  const templates = data?.templates ?? []

  const visibleTemplates = useMemo(
    () => filterCaseTemplates(templates, filter),
    [templates, filter],
  )

  if (
    pathname.startsWith('/case-templates/') &&
    pathname !== '/case-templates/'
  ) {
    return <Outlet />
  }

  const refreshTemplates = () =>
    queryClient.invalidateQueries({ queryKey: caseTemplateKeys.all })

  const duplicateMutation = useMutation({
    mutationFn: duplicateCaseTemplate,
    onSuccess: (copy) => {
      refreshTemplates()
      notifications.show({
        color: 'teal',
        message: `Duplicated as ${copy.name}`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to duplicate template',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (template: CaseTemplate) => deleteCaseTemplate(template.id),
    onSuccess: () => {
      refreshTemplates()
      notifications.show({ message: 'Template deleted' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to delete template',
      }),
  })

  const importMutation = useMutation({
    mutationFn: importCaseTemplate,
    onSuccess: (template) => {
      refreshTemplates()
      notifications.show({
        color: 'green',
        message: `Imported ${template.name}`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to import template',
      }),
  })

  const importTemplate = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      importMutation.mutate(JSON.parse(await file.text()))
    } catch {
      notifications.show({ color: 'red', message: 'Template JSON is invalid' })
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const newTemplateLink = {
    to: '/case-templates/$templateId',
    params: { templateId: 'new' },
  } as const

  return (
    <Box className={classes.page}>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void handleImportFile(event.currentTarget.files?.[0])
        }}
      />
      <Group align="baseline" gap={16} mb={24} wrap="wrap">
        <Title order={1}>Case templates</Title>
        <Text component="span" ff="monospace" fz={12} c="var(--faint)">
          reusable case + task scaffolding · applied at case creation or alert
          promotion
        </Text>
        <Group gap="sm" ml="auto">
          <Button
            variant="default"
            loading={importMutation.isPending}
            onClick={importTemplate}
          >
            Import JSON
          </Button>
          <ButtonLink to={newTemplateLink.to} params={newTemplateLink.params}>
            + New template
          </ButtonLink>
        </Group>
      </Group>

      <Paper radius="md" p="md" mb={20} shadow="xs">
        <Group gap={16}>
          <Text ff="monospace" fz={12} c="var(--muted)">
            filter
          </Text>
          <Tabs
            value={filter}
            onChange={(value) =>
              setFilter((value ?? 'all') as CaseTemplateFilter)
            }
            variant="pills"
          >
            <Tabs.List>
              {filterTabs.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <Text ml="auto" ff="monospace" fz={12} c="var(--faint)">
            click a template name to edit
          </Text>
        </Group>
      </Paper>

      {isPending ? (
        <Paper radius="md" p="xl" shadow="xs">
          <Group justify="center" gap="xs">
            <Loader size="sm" />
            <Text c="dimmed">Loading case templates…</Text>
          </Group>
        </Paper>
      ) : isError ? (
        <Paper radius="md" p="xl" shadow="xs">
          <Stack align="center" gap="sm">
            <Text c="red.7">
              Couldn’t load case templates from the backend.
            </Text>
            <Button
              variant="default"
              loading={isFetching}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </Stack>
        </Paper>
      ) : visibleTemplates.length ? (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing={20}>
          {visibleTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDuplicate={(item) => duplicateMutation.mutate(item)}
              onDelete={(item) => deleteMutation.mutate(item)}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Paper radius="md" p="xl" shadow="xs" ta="center">
          <Text c="dimmed">No case templates found.</Text>
        </Paper>
      )}
    </Box>
  )
}
