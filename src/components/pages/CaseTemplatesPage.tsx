import type {
  CaseTemplate,
  CaseTemplateFilter,
} from '#/components/Cases/caseTemplates.types'
import {
  caseTemplatesList,
  filterCaseTemplates,
  getCaseTemplateStats,
  severityTemplateLabel,
  trafficTemplateLabel,
} from '#/components/Cases/caseTemplates'
import classes from '#/components/Cases/CasesPage.module.css'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

const filterTabs: { value: CaseTemplateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-In' },
  { value: 'custom', label: 'Custom' },
]

function TemplateChip({ children }: { children: string }) {
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
        <Button
          component={Link}
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
        </Button>
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
        {overflowTagCount > 0 && <TemplateChip>+{overflowTagCount}</TemplateChip>}
      </Group>

      <Group gap={16} mt={16} ff="monospace" fz={12} c="var(--faint)">
        <Text component="span" inherit>
          <Text component="span" c="var(--text)" inherit>
            {stats.tasks}
          </Text>{' '}
          tasks
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
        <Button
          component={Link}
          to="/case-templates/$templateId"
          params={{ templateId: template.id }}
          size="xs"
          variant="default"
        >
          Edit
        </Button>
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
  const [templates, setTemplates] = useState<CaseTemplate[]>(caseTemplatesList)
  const { pathname } = useLocation()

  const visibleTemplates = useMemo(
    () => filterCaseTemplates(templates, filter),
    [templates, filter],
  )

  if (pathname.startsWith('/case-templates/') && pathname !== '/case-templates/') {
    return <Outlet />
  }

  const duplicateTemplate = (template: CaseTemplate) => {
    const copy: CaseTemplate = {
      ...template,
      id: `${template.id}-copy-${Date.now().toString(36).slice(-4)}`,
      name: `${template.name} (copy)`,
      builtin: false,
      updated: 'just now',
      tasks: template.tasks.map((task) => ({ ...task })),
      tags: [...template.tags],
      customFields: template.customFields.map((field) => ({ ...field })),
    }

    setTemplates((current) => [...current, copy])
    notifications.show({
      color: 'teal',
      message: `Duplicated as ${copy.name}`,
    })
  }

  const deleteTemplate = (template: CaseTemplate) => {
    if (template.builtin) {
      notifications.show({
        color: 'red',
        message: "Built-in templates can't be deleted — duplicate and edit instead",
      })
      return
    }

    setTemplates((current) =>
      current.filter((currentTemplate) => currentTemplate.id !== template.id),
    )
    notifications.show({ message: 'Template deleted' })
  }

  const importTemplate = () => {
    notifications.show({ message: 'Import JSON coming soon' })
  }

  const newTemplate = () => {
    notifications.show({
      message: 'Use an imported or duplicated template as the starting point',
    })
  }

  const newTemplateLink = {
      to: '/case-templates/$templateId',
      params: { templateId: 'new' },
  } as const

  return (
    <Box className={classes.page}>
      <Group align="baseline" gap={16} mb={24} wrap="wrap">
        <Title order={1}>Case templates</Title>
        <Text component="span" ff="monospace" fz={12} c="var(--faint)">
          reusable case + task scaffolding · applied at case creation or alert
          promotion
        </Text>
        <Group gap="sm" ml="auto">
          <Button variant="default" onClick={importTemplate}>
            Import JSON
          </Button>
          <Button
            component={Link}
            to={newTemplateLink.to}
            params={newTemplateLink.params}
            onClick={newTemplate}
          >
            + New template
          </Button>
        </Group>
      </Group>

      <Paper radius="md" p="md" mb={20} shadow="xs">
        <Group gap={16}>
          <Text ff="monospace" fz={12} c="var(--muted)">
            filter
          </Text>
          <Tabs
            value={filter}
            onChange={(value) => setFilter((value ?? 'all') as CaseTemplateFilter)}
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

      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing={20}>
        {visibleTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onDuplicate={duplicateTemplate}
            onDelete={deleteTemplate}
          />
        ))}
      </SimpleGrid>
    </Box>
  )
}
