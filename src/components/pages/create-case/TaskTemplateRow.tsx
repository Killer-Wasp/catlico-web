import type { CaseTemplateTask } from '#/components/Cases/caseTemplates.types'
import { formatTemplateDue } from '#/components/Cases/caseTemplates'
import { Box, Checkbox, Group, Text } from '@mantine/core'
import { Hourglass, TriangleAlert } from 'lucide-react'
import styles from './styles.module.css'

export function TaskTemplateRow({ task }: { task: CaseTemplateTask }) {
  return (
    <Group
      gap={12}
      wrap="nowrap"
      py={10}
      style={{
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <Checkbox size="xs" readOnly aria-label={`Template task ${task.title}`} />
      <Box flex={1} miw={0}>
        <Group gap={5} wrap="nowrap">
          <Text fw={600} fz={13} truncate>
            {task.title}
          </Text>
          {task.flagged && (
            <TriangleAlert
              size={13}
              aria-label="Flagged task"
              style={{ color: 'var(--sev-medium)', flexShrink: 0 }}
            />
          )}
        </Group>
        <Text className={styles.metaText} truncate>
          {[
            task.group,
            task.assignee,
            task.description ? 'has description' : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      <Text
        component="span"
        ff="monospace"
        fz={10.5}
        c="var(--muted)"
        bg="gray.0"
        px={8}
        py={3}
        style={{ borderRadius: 4, whiteSpace: 'nowrap' }}
      >
        <Hourglass size={11} style={{ verticalAlign: '-1px' }} />{' '}
        {formatTemplateDue(task.dueInHours)}
      </Text>
      <Text
        component="span"
        ff="monospace"
        fz={10}
        fw={700}
        c="var(--muted)"
        bg="gray.0"
        px={8}
        py={3}
        style={{ borderRadius: 99, whiteSpace: 'nowrap' }}
      >
        WAITING
      </Text>
    </Group>
  )
}
