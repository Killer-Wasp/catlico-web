/**
 * ProposedActionsStrip.tsx — inline proposed-action review strip for entity detail panels.
 *
 * Lists proposed actions with inline approve/reject buttons and a pending count
 * badge suitable for rendering above a case/alert/observable timeline.
 */

import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import dayjs from 'dayjs'

import {
  proposedActionsQueryOptions,
  approveProposedAction,
  rejectProposedAction,
  proposedActionKeys,
} from '#/components/Plugins/proposedActions'
import { errorMessage } from '#/lib/ui-helpers'

// ── Action labels ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  add_tag: 'Add tag',
  create_task: 'Create task',
  append_task_log: 'Append task log',
  add_related_observable: 'Add related observable',
  change_severity_status: 'Change severity/status',
  patch_case_description: 'Update description',
  execute_responder_action: 'Execute responder action',
}

function actionLabel(t: string): string {
  return ACTION_LABELS[t] ?? t
}

// ── Props ───────────────────────────────────────────────────────────────────

export type ProposedActionsStripProps = {
  entityType: string
  entityId: string
}

// ── Component ───────────────────────────────────────────────────────────────

export function ProposedActionsStrip({
  entityType,
  entityId,
}: ProposedActionsStripProps) {
  const queryClient = useQueryClient()

  const { data: actions = [], isPending, isError } = useQuery(
    proposedActionsQueryOptions({ entity_type: entityType, entity_id: entityId }),
  )

  const pending = actions.filter((a) => a.status === 'proposed')

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveProposedAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposedActionKeys.all })
      notifications.show({ color: 'green', message: 'Action approved' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Approve failed: ${errorMessage(error)}`,
      }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectProposedAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposedActionKeys.all })
      notifications.show({ color: 'gray', message: 'Action rejected' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Reject failed: ${errorMessage(error)}`,
      }),
  })

  if (isPending) return null
  if (isError || actions.length === 0) return null

  return (
    <Paper p="md" withBorder radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={5} size="h6">
          Proposed Actions
        </Title>
        {pending.length > 0 && (
          <Badge variant="light" color="orange" radius="sm" size="sm">
            {pending.length} pending
          </Badge>
        )}
      </Group>

      <Stack gap="sm">
        {actions.map((action) => (
          <Paper key={action.id} p="sm" radius="md" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={2}>
                <Group gap={8}>
                  <Badge variant="light" size="sm" radius="sm">
                    {actionLabel(action.actionType)}
                  </Badge>
                  <Badge
                    variant="dot"
                    size="sm"
                    color={
                      action.status === 'approved'
                        ? 'green'
                        : action.status === 'rejected'
                          ? 'red'
                          : action.status === 'proposed'
                            ? 'orange'
                            : 'gray'
                    }
                  >
                    {action.status}
                  </Badge>
                </Group>
                <Text fz={12} c="dimmed">
                  by {action.pluginId} · {action.createdAt ? dayjs(action.createdAt).fromNow() : '—'}
                </Text>
                {action.payload && Object.keys(action.payload).length > 0 && (
                  <Text fz={11} ff="monospace" c="dimmed" lineClamp={2}>
                    {JSON.stringify(action.payload)}
                  </Text>
                )}
              </Stack>

              {action.status === 'proposed' && (
                <Group gap={6} wrap="nowrap">
                  <Button
                    size="xs"
                    variant="light"
                    color="green"
                    leftSection={<Check size={14} />}
                    onClick={() => approveMutation.mutate(action.id)}
                    loading={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<X size={14} />}
                    onClick={() => rejectMutation.mutate(action.id)}
                    loading={rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                </Group>
              )}
            </Group>
          </Paper>
        ))}
      </Stack>
    </Paper>
  )
}
