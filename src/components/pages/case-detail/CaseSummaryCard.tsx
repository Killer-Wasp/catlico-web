import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { avatarFor } from '#/components/Cases/cases'
import { trafficLabel } from '#/components/Cases/caseDetails'
import { caseKeys, updateCaseAssignee } from '#/components/Cases/casesQueries'
import { mentionableUsersQueryOptions } from './mentionSuggestion'
import { SEV } from '#/lib/domain'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Tag } from '#/components/Tag/Tag'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { Clock3, Download, Play, UserPlus, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { actionNotice } from './constants'
import styles from './styles.module.css'

export function CaseSummaryCard({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [initials, color] = avatarFor(caseDetail.assignee)
  const { data: members } = useQuery(mentionableUsersQueryOptions())

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      updateCaseAssignee(caseId, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      notifications.show({ color: 'green', message: 'Assignee updated' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: 'Failed to update assignee' })
    },
  })

  return (
    <Paper
      radius="md"
      p="lg"
      withBorder
      style={{
        borderLeft:
          '5px solid light-dark(var(--mantine-color-orange-7), var(--mantine-color-orange-5))',
      }}
    >
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Box flex={1} miw={0}>
          <Group gap={12} mb={8} wrap="wrap">
            <Text className={styles.fieldLabel}>Case {caseDetail.id}</Text>
            <Text
              ff="monospace"
              fz={11}
              fw={700}
              c={`var(--sev-${SEV[caseDetail.sev]})`}
            >
              {SEV[caseDetail.sev].toUpperCase()}
            </Text>
            <StatusBadge
              status={caseDetail.status}
              label={caseDetail.statusName}
            />
          </Group>

          <Title order={1} size="h2" mb={14}>
            {caseDetail.title}
          </Title>

          <Group gap={8} mb="md" wrap="wrap">
            <TrafficBadge label="TLP" value={caseDetail.tlp} />
            <TrafficBadge label="PAP" value={caseDetail.pap} />
            {caseDetail.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
            <Badge
              variant="light"
              color="orange"
              radius="sm"
              leftSection={<Clock3 size={12} />}
            >
              {caseDetail.sla}
            </Badge>
          </Group>
        </Box>

        <Group gap="sm" visibleFrom="md" wrap="nowrap">
          <Menu shadow="md" width={260} position="bottom-end">
            <Menu.Target>
              <Button
                variant="default"
                leftSection={<UserPlus size={16} />}
                loading={assignMutation.isPending}
              >
                Assign
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={
                  <Avatar size={24} radius="xl" bg="#54463A">
                    —
                  </Avatar>
                }
                onClick={() => assignMutation.mutate(null)}
              >
                Unassigned
              </Menu.Item>
              {members?.map((member) => {
                const [mi, mc] = avatarFor(member.email)
                return (
                  <Menu.Item
                    key={member.id}
                    leftSection={
                      <Avatar size={24} radius="xl" bg={mc}>
                        {mi}
                      </Avatar>
                    }
                    onClick={() => assignMutation.mutate(member.id)}
                  >
                    {member.label}
                  </Menu.Item>
                )
              })}
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="default"
            leftSection={<Download size={16} />}
            onClick={() => actionNotice('Report export queued')}
          >
            Export report
          </Button>
          <Button
            variant="default"
            leftSection={<XCircle size={16} />}
            onClick={() => actionNotice('Close case workflow opened')}
          >
            Close case
          </Button>
          <Button
            color="orange"
            leftSection={<Play size={16} />}
            onClick={() => actionNotice('Analyzer run queued')}
          >
            Run analyzers
          </Button>
        </Group>
      </Group>

      <Divider my="md" />

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 6 }} spacing="md">
        <SummaryField label="Assignee">
          <Group gap={8} wrap="nowrap">
            <Avatar size={28} radius="xl" color="orange" bg={color}>
              {initials}
            </Avatar>
            <Text fw={700}>{caseDetail.assignee}</Text>
          </Group>
        </SummaryField>
        <SummaryField label="Opened">{caseDetail.opened}</SummaryField>
        <SummaryField label="Source">{caseDetail.source}</SummaryField>
        <SummaryField label="Business unit">
          {caseDetail.businessUnit}
        </SummaryField>
        <SummaryField label="Tasks">
          {caseDetail.tasksDone} / {caseDetail.tasksTotal} done
        </SummaryField>
        <SummaryField label="Observables">
          {caseDetail.observables.length} &middot;{' '}
          {caseDetail.observables.filter((observable) => observable.ioc).length}{' '}
          IOC
        </SummaryField>
      </SimpleGrid>

      <Group gap="sm" hiddenFrom="md" mt="lg">
        <Menu shadow="md" width={260} position="bottom-start">
          <Menu.Target>
            <Button
              variant="default"
              leftSection={<UserPlus size={16} />}
              loading={assignMutation.isPending}
            >
              Assign
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <Avatar size={24} radius="xl" bg="#54463A">
                  —
                </Avatar>
              }
              onClick={() => assignMutation.mutate(null)}
            >
              Unassigned
            </Menu.Item>
            {members?.map((member) => {
              const [mi, mc] = avatarFor(member.email)
              return (
                <Menu.Item
                  key={member.id}
                  leftSection={
                    <Avatar size={24} radius="xl" bg={mc}>
                      {mi}
                    </Avatar>
                  }
                  onClick={() => assignMutation.mutate(member.id)}
                >
                  {member.label}
                </Menu.Item>
              )
            })}
          </Menu.Dropdown>
        </Menu>
        <Button color="orange" leftSection={<Play size={16} />}>
          Run analyzers
        </Button>
      </Group>
    </Paper>
  )
}

function SummaryField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Box>
      <Text className={styles.fieldLabel} mb={4}>
        {label}
      </Text>
      <Text fw={650}>{children}</Text>
    </Box>
  )
}

export function TrafficBadge({
  label,
  value,
}: {
  label: 'TLP' | 'PAP'
  value: 0 | 1 | 2 | 3
}) {
  return (
    <Badge
      radius="sm"
      variant="light"
      color={value === 2 ? 'yellow' : value === 1 ? 'green' : 'gray'}
      tt="uppercase"
      ff="monospace"
    >
      {label}: {trafficLabel(value)}
    </Badge>
  )
}
