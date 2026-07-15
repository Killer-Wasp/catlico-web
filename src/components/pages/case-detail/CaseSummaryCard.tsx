import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { avatarFor } from '#/components/Cases/cases'
import { trafficLabel } from '#/components/Cases/caseDetails'
import {
  caseKeys,
  caseObservablesQueryOptions,
  closeCase,
  setCaseTags,
  updateCaseAssignee,
} from '#/components/Cases/casesQueries'
import { CaseReportExportDialog } from './CaseReportExportDialog'
import { PluginPickerDialog } from '#/components/Plugins/PluginPickerDialog'
import type { PluginPickerSelection } from '#/components/Plugins/PluginPickerDialog'
import {
  analyzerRunTargets,
  dispatchAnalyzerRuns,
  dispatchCaseResponderRuns,
  notifyAnalyzerRuns,
} from '#/components/Plugins/runAnalyzers'
import { mentionableUsersQueryOptions } from './mentionSuggestion'
import { ManageAssigneesPopover } from '#/components/Assign/ManageAssigneesPopover'
import { setCaseAssignees } from '#/components/Assign/assignees'
import { SEV } from '#/lib/domain'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Tag } from '#/components/Tag/Tag'
import { TagPickerInput } from '#/components/Tag/TagPickerInput'
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import {
  ChevronDown,
  Download,
  MoreHorizontal,
  Play,
  XCircle,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { SlaChip } from '#/components/Cases/SlaChip'
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
  const [editingTags, setEditingTags] = useState(false)
  const [draftTags, setDraftTags] = useState(caseDetail.tags)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [responderPickerOpen, setResponderPickerOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // The case's observables, sourced from the same query the Observables tab
  // uses. "Run analyzers" fans a picker selection out across all of them.
  const {
    data: caseObservables = [],
    isLoading: observablesLoading,
    isError: observablesError,
  } = useQuery(caseObservablesQueryOptions(caseId))

  const runCaseAnalyzers = useMutation({
    mutationFn: ({ pluginIds, force }: PluginPickerSelection) =>
      dispatchAnalyzerRuns(
        analyzerRunTargets(
          caseObservables.map((observable) => observable.id),
          pluginIds,
        ),
        force,
      ),
    onSuccess: (results) => notifyAnalyzerRuns(results),
    // Keep the picker open with its Run spinner while the fan-out is in flight;
    // the caller (not the dialog) closes it once the mutation settles.
    onSettled: () => setPickerOpen(false),
  })

  // Responders act on the case itself, so there's no observable fan-out and no
  // zero-observables dead end — just open the picker (filtered to responders).
  // Its Run stays disabled until a plugin is picked, and the picker shows its own
  // empty state when no responder is runnable.
  const runCaseResponders = useMutation({
    mutationFn: ({ pluginIds, force }: PluginPickerSelection) =>
      dispatchCaseResponderRuns(caseId, pluginIds, force),
    onSuccess: (results) => notifyAnalyzerRuns(results),
    onSettled: () => setResponderPickerOpen(false),
  })

  // Zero-observables is a dead end for a fan-out, so short-circuit with a
  // friendly notice rather than opening a picker that can dispatch nothing.
  // But `data` is also `[]` while the query is loading or errored, so only
  // treat an empty list as "no observables" once the query has settled with
  // data — otherwise open the picker (its Run stays disabled until a plugin is
  // selected, by which point the observables have loaded).
  const handleRunAnalyzers = () => {
    if (observablesLoading || observablesError) {
      setPickerOpen(true)
      return
    }
    if (caseObservables.length === 0) {
      actionNotice('No observables to analyze')
      return
    }
    setPickerOpen(true)
  }

  useEffect(() => {
    setEditingTags(false)
    setDraftTags(caseDetail.tags)
  }, [caseDetail.id, caseDetail.tags])

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

  const tagsMutation = useMutation({
    mutationFn: (tags: string[]) => setCaseTags(caseId, tags),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: caseKeys.fullDetail(caseId),
      })
      void queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      setEditingTags(false)
      notifications.show({ color: 'green', message: 'Case tags updated' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: 'Failed to update tags' })
    },
  })

  const collaboratorsMutation = useMutation({
    mutationFn: (collaboratorIds: string[]) =>
      setCaseAssignees(caseId, collaboratorIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: caseKeys.fullDetail(caseId),
      })
      void queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      notifications.show({ color: 'green', message: 'Assignees updated' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: 'Failed to update assignees' })
    },
  })

  const closeCaseMutation = useMutation({
    mutationFn: () => closeCase(caseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: caseKeys.detail(caseId),
      })
      void queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      notifications.show({ color: 'green', message: 'Case closed' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: 'Failed to close case' })
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

          {editingTags ? (
            <Stack gap="xs" mb="md">
              <TagPickerInput
                label="Tags"
                placeholder="e.g. finance, T1566"
                suggestions={caseDetail.tags}
                value={draftTags}
                onChange={setDraftTags}
              />
              <Group justify="flex-end">
                <Button
                  size="xs"
                  loading={tagsMutation.isPending}
                  onClick={() => tagsMutation.mutate(draftTags)}
                >
                  Save tags
                </Button>
              </Group>
            </Stack>
          ) : (
            <Group
              data-testid="case-summary-tags-row"
              gap={8}
              mb="md"
              wrap="wrap"
            >
              {caseDetail.tags.map((tag) => (
                <Tag key={tag} label={tag} size="sm" />
              ))}
              <button
                type="button"
                className={styles.addTagButton}
                onClick={() => {
                  setDraftTags(caseDetail.tags)
                  setEditingTags(true)
                }}
              >
                + add tag
              </button>
            </Group>
          )}

          <Group
            data-testid="case-summary-traffic-row"
            gap={8}
            mb="md"
            wrap="wrap"
          >
            <TrafficBadge label="TLP" value={caseDetail.tlp} />
            <TrafficBadge label="PAP" value={caseDetail.pap} />
            <SlaChip state={caseDetail.slaState} dueAt={caseDetail.slaDueAt} />
          </Group>
        </Box>

        <CaseActionsMenu
          closeDisabled={caseDetail.status !== 'open'}
          closePending={closeCaseMutation.isPending}
          onCloseCase={() => closeCaseMutation.mutate()}
          onRunAnalyzers={handleRunAnalyzers}
          onRunResponders={() => setResponderPickerOpen(true)}
          onExportReport={() => setExportOpen(true)}
        />
      </Group>

      <Divider my="md" />

      <Group gap="xl" wrap="wrap" data-testid="case-summary-footer">
        <AssigneeMenu
          assignee={caseDetail.assignee}
          initials={initials}
          color={color}
          members={members}
          assignPending={assignMutation.isPending}
          onAssign={(assigneeId) => assignMutation.mutate(assigneeId)}
        />

        <Divider orientation="vertical" visibleFrom="xs" />

        <SummaryField label="Assignees">
          <ManageAssigneesPopover
            assignees={caseDetail.assignees ?? []}
            pending={collaboratorsMutation.isPending}
            onChange={(ids) => collaboratorsMutation.mutate(ids)}
          />
        </SummaryField>

        <Divider orientation="vertical" visibleFrom="xs" />

        <SummaryField label="Opened">
          {caseDetail.opened}
          <Text span c="dimmed" fw={500} fz="sm" ml={6}>
            {caseDetail.openedAgo}
          </Text>
        </SummaryField>
        {caseDetail.updated != null ? (
          <SummaryField label="Last updated">
            {caseDetail.updated}
            {caseDetail.updatedAgo != null ? (
              <Text span c="dimmed" fw={500} fz="sm" ml={6}>
                {caseDetail.updatedAgo}
              </Text>
            ) : null}
          </SummaryField>
        ) : null}
        {caseDetail.closed != null ? (
          <SummaryField label="Closed">{caseDetail.closed}</SummaryField>
        ) : null}
      </Group>

      <PluginPickerDialog
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        isRunning={runCaseAnalyzers.isPending}
        contextLabel={`Run on ${caseObservables.length} observable${
          caseObservables.length === 1 ? '' : 's'
        } in case ${caseDetail.id}`}
        onRun={(selection) => runCaseAnalyzers.mutate(selection)}
      />

      <PluginPickerDialog
        opened={responderPickerOpen}
        onClose={() => setResponderPickerOpen(false)}
        capability="responder"
        noun="responder"
        isRunning={runCaseResponders.isPending}
        contextLabel={`Run on case ${caseDetail.id}`}
        onRun={(selection) => runCaseResponders.mutate(selection)}
      />

      <CaseReportExportDialog
        caseId={caseId}
        caseNumber={caseDetail.id}
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </Paper>
  )
}

function AssigneeMenu({
  assignee,
  initials,
  color,
  members,
  assignPending,
  onAssign,
}: {
  assignee: string
  initials: string
  color: string
  members:
    | {
        id: string
        email: string
        label: string
      }[]
    | undefined
  assignPending: boolean
  onAssign: (assigneeId: string | null) => void
}) {
  return (
    <Menu shadow="md" width={280} position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton
          aria-label="Change assignee"
          disabled={assignPending}
          style={{ opacity: assignPending ? 0.6 : undefined }}
        >
          <Group gap={10} wrap="nowrap">
            <Avatar size={36} radius="xl" color="orange" bg={color}>
              {initials}
            </Avatar>
            <Box>
              <Text className={styles.fieldLabel} mb={2}>
                Assignee
              </Text>
              <Group gap={4} wrap="nowrap">
                <Text fw={700}>{assignee}</Text>
                <ChevronDown
                  size={14}
                  color="var(--mantine-color-dimmed)"
                  aria-hidden
                />
              </Group>
            </Box>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={
            <Avatar size={24} radius="xl" bg="#54463A">
              —
            </Avatar>
          }
          onClick={() => onAssign(null)}
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
              onClick={() => onAssign(member.id)}
            >
              {member.label}
            </Menu.Item>
          )
        })}
      </Menu.Dropdown>
    </Menu>
  )
}

function CaseActionsMenu({
  closeDisabled,
  closePending,
  onCloseCase,
  onRunAnalyzers,
  onRunResponders,
  onExportReport,
}: {
  closeDisabled: boolean
  closePending: boolean
  onCloseCase: () => void
  onRunAnalyzers: () => void
  onRunResponders: () => void
  onExportReport: () => void
}) {
  return (
    <Menu shadow="md" width={280} position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon aria-label="Case actions" variant="default" size="lg">
          <MoreHorizontal size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<Download size={16} />}
          onClick={onExportReport}
        >
          Export report
        </Menu.Item>
        <Menu.Item
          color="orange"
          leftSection={<Play size={16} />}
          onClick={onRunAnalyzers}
        >
          Run analyzers
        </Menu.Item>
        <Menu.Item
          color="orange"
          leftSection={<Zap size={16} />}
          onClick={onRunResponders}
        >
          Run responder
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          disabled={closeDisabled || closePending}
          leftSection={<XCircle size={16} />}
          onClick={onCloseCase}
        >
          Close case
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
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
      <Box className={styles.summaryFieldValue}>{children}</Box>
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
