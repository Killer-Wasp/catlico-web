import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { actionNotice } from './constants'

export function CaseSideRail({ caseDetail }: { caseDetail: CaseDetail }) {
  return (
    <Stack gap="md">
      <SideCard
        title="Run responder"
        badge="Cortex"
        action={
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Add responder"
            onClick={() => actionNotice('Responder picker opened')}
          >
            <Plus size={16} />
          </ActionIcon>
        }
      >
        <Stack gap="xs">
          {caseDetail.responders.map((responder) => (
            <Button
              key={responder.action}
              variant="default"
              justify="space-between"
              fullWidth
              onClick={() =>
                actionNotice(
                  `${responder.action} queued via ${responder.provider}`,
                )
              }
              rightSection={
                <Text ff="monospace" fz={11} c="dimmed">
                  {responder.provider}
                </Text>
              }
            >
              {responder.action}
            </Button>
          ))}
        </Stack>
      </SideCard>

      <SideCard title="Related cases">
        <Stack gap={0}>
          {caseDetail.related.map((related) => (
            <Group
              key={related.id}
              py={8}
              gap="sm"
              wrap="nowrap"
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Text ff="monospace" fz={13} c="dimmed">
                {related.id}
              </Text>
              <Text fw={600} truncate>
                {related.title}
              </Text>
            </Group>
          ))}
        </Stack>
      </SideCard>

      <SideCard title="TTPs" badge="ATT&CK">
        <Group gap={6} wrap="wrap">
          {caseDetail.ttps.map((ttp) => (
            <Tag key={ttp} label={ttp} />
          ))}
          <Tag label="+ technique" />
        </Group>
      </SideCard>
    </Stack>
  )
}

function SideCard({
  title,
  badge,
  action,
  children,
}: {
  title: string
  badge?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper radius="md" withBorder>
      <Group
        px="md"
        py="sm"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Text fw={700}>{title}</Text>
        {badge ? (
          <Badge variant="default" color="gray" radius="xl">
            {badge}
          </Badge>
        ) : null}
        <Box ml="auto">{action}</Box>
      </Group>
      <Box p="md">{children}</Box>
    </Paper>
  )
}
