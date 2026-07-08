import type {
  CaseDetail,
  CaseDetailAlert,
} from '#/components/Cases/caseDetails.types'
import { Tag } from '#/components/Tag/Tag'
import { SEV } from '#/lib/domain'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { actionNotice } from './constants'
import { AlertDrawer } from '../alerts/AlertDrawer'

export function CaseSideRail({ caseDetail }: { caseDetail: CaseDetail }) {
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)

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

      <SideCard title="Linked alerts">
        <Stack gap={0}>
          {caseDetail.linkedAlerts.map((alert) => (
            <LinkedAlertRow
              key={alert.id}
              alert={alert}
              onOpen={() => setActiveAlertId(alert.id)}
            />
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

      <AlertDrawer
        alertId={activeAlertId}
        onClose={() => setActiveAlertId(null)}
        hideActions
      />
    </Stack>
  )
}

function LinkedAlertRow({
  alert,
  onOpen,
}: {
  alert: CaseDetailAlert
  onOpen: () => void
}) {
  return (
    <UnstyledButton
      onClick={onOpen}
      w="100%"
      aria-label={`Open alert ${alert.id}`}
    >
      <Group
        gap="sm"
        wrap="nowrap"
        py={10}
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Box
          w={4}
          h={22}
          bg={`var(--sev-${SEV[alert.sev]})`}
          style={{ borderRadius: 3, flexShrink: 0 }}
        />
        <Text ff="monospace" fz={13} c="dimmed" style={{ flexShrink: 0 }}>
          {alert.id}
        </Text>
        <Text fz={13} truncate>
          {alert.title}
        </Text>
      </Group>
    </UnstyledButton>
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
