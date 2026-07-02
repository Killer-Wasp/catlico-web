import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { Tag } from '#/components/Tag/Tag'
import { ButtonLink } from '#/components/ui/ButtonLink'
import { ActionIcon, Group, Menu, Table, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Copy, EllipsisVertical, Pencil, Trash2 } from 'lucide-react'

export function TemplateRow({
  template,
  onDuplicate,
  onDelete,
}: {
  template: CaseTemplate
  onDuplicate: (template: CaseTemplate) => void
  onDelete: (template: CaseTemplate) => void
}) {
  return (
    <Table.Tr>
      <Table.Td>
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
      </Table.Td>
      <Table.Td>
        {template.tags.length ? (
          <Group gap={6}>
            {template.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </Group>
        ) : (
          <Text component="span" ff="monospace" fz={12} c="var(--faint)">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <ActionIcon
              aria-label={`Template actions for ${template.name}`}
              variant="subtle"
              color="gray"
            >
              <EllipsisVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              component={Link}
              to="/case-templates/$templateId"
              params={{ templateId: template.id }}
              leftSection={<Pencil size={14} />}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              leftSection={<Copy size={14} />}
              onClick={() => onDuplicate(template)}
            >
              Duplicate
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => onDelete(template)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  )
}
