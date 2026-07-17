import {
  Badge,
  Button,
  ColorInput,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import {
  CASE_STAGE_OPTIONS,
  caseStatusKeys,
  caseStatusesQueryOptions,
  createCaseStatus,
  deleteCaseStatus,
  updateCaseStatus,
} from '#/components/Cases/caseStatusesQueries'
import type { CaseStatusPublic } from '#/components/Cases/caseStatusesQueries'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'
import { FormDrawer } from '#/components/ui/FormDrawer'
import { usePermissions } from '#/lib/auth/usePermissions'
import type { CaseStage } from '#/lib/domain'

function AddStatusModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [stage, setStage] = useState<CaseStage>('in_progress')
  const [color, setColor] = useState('#6b7280')

  const reset = () => {
    setLabel('')
    setStage('in_progress')
    setColor('#6b7280')
  }

  const mutation = useMutation({
    mutationFn: () =>
      createCaseStatus({ label: label.trim(), stage, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseStatusKeys.list() })
      notifySuccess('Case status created')
      reset()
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create case status'),
  })

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title="Add case status"
      submitLabel="Create status"
      loading={mutation.isPending}
      submitDisabled={!label.trim()}
      onSubmit={() => mutation.mutate()}
    >
      <Stack gap="md">
        <TextInput
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          required
        />
        <Select
          label="Stage"
          description="Drives SLA, overview and the merged read-only behaviour."
          data={CASE_STAGE_OPTIONS}
          value={stage}
          onChange={(v) => v && setStage(v as CaseStage)}
          allowDeselect={false}
        />
        <ColorInput label="Colour" value={color} onChange={setColor} />
      </Stack>
    </FormDrawer>
  )
}

export function CaseStatusesPanel() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canWrite = can('write:organisation')
  const {
    data: statuses = [],
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(caseStatusesQueryOptions())
  const [addOpen, setAddOpen] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: caseStatusKeys.list() })

  const patchMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: Partial<{ hidden: boolean; position: number }>
    }) => updateCaseStatus(id, body),
    onSuccess: () => invalidate(),
    onError: (error) => notifyError(error, 'Unable to update case status'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCaseStatus,
    onSuccess: () => {
      invalidate()
      notifySuccess('Case status deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete case status'),
  })

  // Reorder by swapping adjacent positions (statuses arrive position-sorted).
  const move = (index: number, dir: -1 | 1) => {
    const a = statuses[index]
    const b = statuses[index + dir]
    if (!a || !b) return
    patchMutation.mutate({ id: a.id, body: { position: b.position } })
    patchMutation.mutate({ id: b.id, body: { position: a.position } })
  }

  if (isPending) return <LoadingPanel label="Loading case statuses..." />
  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load case statuses."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <>
      <AddStatusModal opened={addOpen} onClose={() => setAddOpen(false)} />
      <Panel
        title="Case statuses"
        count={statuses.length}
        action={
          canWrite ? (
            <Button variant="default" onClick={() => setAddOpen(true)}>
              + Add status
            </Button>
          ) : undefined
        }
      >
        <Stack gap="xs" data-testid="case-statuses-list">
          {statuses.map((s: CaseStatusPublic, i) => (
            <Group
              key={s.id}
              justify="space-between"
              wrap="nowrap"
              data-testid={`case-status-row-${s.id}`}
            >
              <Group gap="sm" wrap="nowrap">
                <StatusBadge label={s.label} color={s.color} />
                <Text size="xs" c="dimmed">
                  {s.stage}
                </Text>
                {s.is_builtin ? (
                  <Badge size="xs" variant="light" color="gray">
                    Built-in
                  </Badge>
                ) : null}
                {s.hidden ? (
                  <Badge size="xs" variant="light" color="yellow">
                    Hidden
                  </Badge>
                ) : null}
              </Group>
              {canWrite ? (
                <Group gap={4} wrap="nowrap">
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    aria-label={`Move ${s.label} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    aria-label={`Move ${s.label} down`}
                    disabled={i === statuses.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Switch
                    size="xs"
                    label="Hidden"
                    checked={s.hidden}
                    onChange={(e) =>
                      patchMutation.mutate({
                        id: s.id,
                        body: { hidden: e.currentTarget.checked },
                      })
                    }
                  />
                  {!s.is_builtin ? (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        confirmDelete({
                          title: 'Delete case status',
                          message: `Delete the "${s.label}" status? Cases still using it will block the delete — hide it instead.`,
                          onConfirm: () => deleteMutation.mutate(s.id),
                        })
                      }
                    >
                      Delete
                    </Button>
                  ) : null}
                </Group>
              ) : null}
            </Group>
          ))}
        </Stack>
      </Panel>
    </>
  )
}
