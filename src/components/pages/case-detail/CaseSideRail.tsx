import type {
  CaseDetail,
  CaseDetailAlert,
} from '#/components/Cases/caseDetails.types'
import { SEV } from '#/lib/domain'
import {
  Badge,
  Box,
  Group,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { TtpsPanel } from './TtpsPanel'
import { AlertDrawer } from '../alerts/AlertDrawer'

export function CaseSideRail({ caseDetail }: { caseDetail: CaseDetail }) {
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)

  return (
    <Stack gap="md">
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
        <TtpsPanel caseId={caseDetail.id} />
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
  children,
}: {
  title: string
  badge?: string
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
      </Group>
      <Box p="md">{children}</Box>
    </Paper>
  )
}
