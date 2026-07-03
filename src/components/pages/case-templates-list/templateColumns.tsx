import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { severityTemplateLabel } from '#/components/Cases/caseTemplates'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Text,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ColumnDef, SortingFn } from '@tanstack/react-table'
import { Copy, EllipsisVertical, Pencil, Trash2 } from 'lucide-react'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import {
  includesAnySubstring,
  includesAnyTag,
  includesOne,
} from '#/components/Table/tableFilters'

// `updated` is a preformatted date string that doesn't sort chronologically,
// so order by the numeric apiId (higher = created more recently) instead.
const byApiId: SortingFn<CaseTemplate> = (a, b) =>
  (a.original.apiId ?? 0) - (b.original.apiId ?? 0)

export function buildTemplateColumns({
  openTemplate,
  onDuplicate,
  onDelete,
}: {
  openTemplate: (id: string) => void
  onDuplicate: (template: CaseTemplate) => void
  onDelete: (template: CaseTemplate) => void
}): ColumnDef<CaseTemplate>[] {
  return [
    {
      id: 'template',
      header: 'Template',
      accessorFn: (row) => row.name,
      filterFn: includesAnySubstring,
      enableSorting: true,
      cell: (info) => {
        const tags = info.row.original.tags
        return (
          <Box>
            <Link
              to="/case-templates/$templateId"
              params={{ templateId: info.row.original.id }}
              style={{
                display: 'inline-block',
                maxWidth: 420,
                fontWeight: 500,
                color: 'inherit',
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {info.getValue<string>()}
            </Link>
            {tags.length > 0 && (
              <Group gap={6} mt={4} wrap="wrap">
                {tags.map((t) => (
                  <Tag key={t} label={t} />
                ))}
              </Group>
            )}
          </Box>
        )
      },
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (row) => (row.builtin ? 'builtin' : 'custom'),
      filterFn: includesOne,
      enableSorting: false,
      meta: { visibleFrom: 'md' } satisfies TableColumnMeta,
      cell: (info) => (
        <Badge variant="light" color="gray" radius="sm" tt="uppercase">
          {info.getValue<string>() === 'builtin' ? 'Built-in' : 'Custom'}
        </Badge>
      ),
    },
    {
      id: 'sev',
      header: 'Sev',
      accessorFn: (row) => row.sev,
      filterFn: includesOne,
      enableSorting: true,
      meta: { visibleFrom: 'md' } satisfies TableColumnMeta,
      cell: (info) => (
        <Text ff="monospace" fz={11} c="var(--muted)">
          {severityTemplateLabel(info.getValue<CaseTemplate['sev']>())}
        </Text>
      ),
    },
    {
      id: 'tasks',
      header: 'Tasks',
      accessorFn: (row) => row.tasks.length,
      enableColumnFilter: false,
      enableSorting: true,
      meta: { ta: 'center', visibleFrom: 'md' } satisfies TableColumnMeta,
      cell: (info) => (
        <Text ff="monospace" fz={11} c="var(--muted)">
          {info.getValue<number>()}
        </Text>
      ),
    },
    {
      id: 'tags',
      accessorFn: (row) => row.tags,
      filterFn: includesAnyTag,
      // Filter-only column; rendered inline in the template cell.
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'updated',
      header: 'Updated',
      accessorFn: (row) => row.updated,
      enableColumnFilter: false,
      enableSorting: true,
      sortingFn: byApiId,
      meta: { visibleFrom: 'lg' } satisfies TableColumnMeta,
      cell: (info) => (
        <Text
          ff="monospace"
          fz={11}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        >
          {info.getValue<string>()}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableColumnFilter: false,
      enableSorting: false,
      meta: { ta: 'right' } satisfies TableColumnMeta,
      cell: ({ row }) => (
        <Menu position="bottom-end" withinPortal withArrow shadow="md">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Template actions for ${row.original.name}`}
            >
              <EllipsisVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<Pencil size={14} />}
              onClick={() => openTemplate(row.original.id)}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              leftSection={<Copy size={14} />}
              onClick={() => onDuplicate(row.original)}
            >
              Duplicate
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => onDelete(row.original)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
