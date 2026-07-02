import type {
  CaseTemplate,
  CaseTemplateFilter,
} from '#/components/Cases/caseTemplates.types'
import { filterCaseTemplates } from '#/components/Cases/caseTemplates'
import {
  caseTemplateKeys,
  caseTemplatesQueryOptions,
  deleteCaseTemplate,
  duplicateCaseTemplate,
  importCaseTemplate,
} from '#/components/Cases/caseTemplatesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, useLocation } from '@tanstack/react-router'
import { ButtonLink } from '#/components/ui/ButtonLink'
import { useMemo, useRef, useState } from 'react'
import { filterTabs } from './case-templates/constants'
import { TemplateRow } from './case-templates/TemplateRow'

export function CaseTemplatesPage() {
  const { pathname } = useLocation()

  if (
    pathname.startsWith('/case-templates/') &&
    pathname !== '/case-templates/'
  ) {
    return <Outlet />
  }

  return <CaseTemplatesIndex />
}

function CaseTemplatesIndex() {
  const [filter, setFilter] = useState<CaseTemplateFilter>('all')
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
        <Paper radius="md" shadow="xs" withBorder>
          <Table.ScrollContainer minWidth={680}>
            <Table
              aria-label="Case templates"
              verticalSpacing="sm"
              horizontalSpacing="lg"
              highlightOnHover
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Text ff="monospace" fz={11} c="var(--faint)" fw={700}>
                      Template
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text ff="monospace" fz={11} c="var(--faint)" fw={700}>
                      Tags
                    </Text>
                  </Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleTemplates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    onDuplicate={(item) => duplicateMutation.mutate(item)}
                    onDelete={(item) => deleteMutation.mutate(item)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : (
        <Paper radius="md" p="xl" shadow="xs" ta="center">
          <Text c="dimmed">No case templates found.</Text>
        </Paper>
      )}
    </Box>
  )
}
