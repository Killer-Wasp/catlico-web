import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import {
  caseTemplateKeys,
  caseTemplatesQueryOptions,
  deleteCaseTemplate,
  duplicateCaseTemplate,
  importCaseTemplate,
} from '#/components/Cases/caseTemplatesQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { organisationMembersQueryOptions } from '#/components/pages/settings/settingsQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
import { DataTable } from '#/components/Table/DataTable'
import { getActiveOrgId } from '#/lib/auth/session'
import type { ResolvedAuthor } from './case-templates-list/templateColumns'
import { TablePanel } from '#/components/Table/TablePanel'
import { SEVERITY_OPTIONS } from '#/lib/domain'
import { Box, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useCallback, useMemo, useRef, useState } from 'react'
import { buildTemplateColumns } from './case-templates-list/templateColumns'

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement>(null)
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    caseTemplatesQueryOptions(),
  )
  const templates = data?.templates ?? []

  const orgId = getActiveOrgId()
  const { data: members } = useQuery({
    ...organisationMembersQueryOptions(orgId ?? ''),
    enabled: Boolean(orgId),
  })
  const memberById = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m])),
    [members],
  )
  const resolveAuthor = useCallback(
    (author: string): ResolvedAuthor => {
      const member = memberById.get(author)
      if (!member) return { name: 'Unknown', user: null }
      return {
        name: userDisplayName(member),
        user: {
          id: member.user_id,
          email: member.email,
          first_name: member.first_name,
          last_name: member.last_name,
          has_avatar: member.has_avatar,
        },
      }
    },
    [memberById],
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

  const openTemplate = (id: string) =>
    navigate({ to: '/case-templates/$templateId', params: { templateId: id } })
  const createTemplate = () =>
    navigate({
      to: '/case-templates/$templateId',
      params: { templateId: 'new' },
    })

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const columns = useMemo<ColumnDef<CaseTemplate>[]>(
    () =>
      buildTemplateColumns({
        openTemplate,
        onDuplicate: (t) => duplicateMutation.mutate(t),
        onDelete: (t) => deleteMutation.mutate(t),
        resolveAuthor,
      }),
    [resolveAuthor],
  )

  const table = useReactTable({
    data: templates,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
      columnVisibility: { tags: false },
    },
    getRowId: (row) => row.id,
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const tagOptions = useMemo(
    () => Array.from(new Set(templates.flatMap((t) => t.tags))).sort(),
    [templates],
  )
  const filterFields = useMemo(
    () => [
      {
        key: 'tag',
        label: 'Tag',
        kind: 'enum' as const,
        columnId: 'tags',
        options: tagOptions.map((x) => ({ value: x, label: x })),
      },
      {
        key: 'type',
        label: 'Type',
        kind: 'enum' as const,
        columnId: 'type',
        options: [
          { value: 'builtin', label: 'Built-in' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      {
        key: 'severity',
        label: 'Severity',
        kind: 'enum' as const,
        columnId: 'sev',
        options: SEVERITY_OPTIONS,
      },
      {
        key: 'name',
        label: 'Name',
        kind: 'text' as const,
        columnId: 'template',
      },
    ],
    [tagOptions],
  )

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
      <TablePanel
        title="Case templates"
        countNoun="templates"
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter templates — type to search name, or pick a field"
        filterDefaultTextField="name"
        actions={
          <Group gap="xs">
            <Button
              variant="default"
              size="xs"
              loading={importMutation.isPending}
              onClick={importTemplate}
            >
              Import JSON
            </Button>
            <Button size="xs" onClick={createTemplate}>
              + New template
            </Button>
          </Group>
        }
      >
        {isPending ? (
          <Group justify="center" gap="xs" py="xl">
            <Loader size="sm" />
            <Text c="dimmed">Loading case templates…</Text>
          </Group>
        ) : isError ? (
          <Stack align="center" gap="sm" py="xl">
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
        ) : (
          <DataTable
            table={table}
            minWidth={760}
            ariaLabel="Case templates"
            emptyMessage="No templates match the current filters."
            isFetching={isFetching}
            stopPropagationColumnIds={['template', 'actions']}
            onRowClick={(row) => openTemplate(row.original.id)}
          />
        )}
      </TablePanel>
    </Box>
  )
}
