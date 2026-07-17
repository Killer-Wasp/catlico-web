/**
 * Confirm dialog for merging 2+ cases into a fresh survivor case.
 *
 * The survivor form is pre-filled from the sources: title from the
 * highest-severity source, severity = MAX, and tlp/pap = the MOST restrictive
 * (max) among sources. TLP/PAP values less restrictive than any source are
 * disabled (via SegmentedButtons' `isDisabled`) — a client-side mirror of the
 * backend's floor guard, which floors ONLY tlp/pap (severity stays freely
 * editable). Assignee, summary and description are the explicit "human decides"
 * fields and start blank.
 *
 * On submit it calls `mergeCases`, then navigates to the new survivor case and
 * clears the caller's selection (`onMerged`). Backend errors (409 already
 * merged, tlp/pap floor violation) surface via a notification.
 */
import { AssignMenu } from '#/components/Table/AssignMenu'
import type { UserPublic } from '#/components/Users/usersQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
import { FormDrawer } from '#/components/ui/FormDrawer'
import {
  Alert,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  SEVERITY_CHOICES,
  TRAFFIC_CHOICES,
} from '#/components/pages/create-case/constants'
import type {
  SeverityChoice,
  TrafficLight,
} from '#/components/pages/create-case/constants'
import { FieldLabel, SegmentedButtons } from '#/components/pages/create-case/Fields'
import type { Case } from './cases.types'
import { caseKeys, mergeCases } from './casesQueries'

/** A case-to-case merge needs at least two distinct sources. */
export function canMergeCases(count: number): boolean {
  return count >= 2
}

const maxBy = <T,>(items: T[], pick: (item: T) => number): number =>
  items.reduce((acc, item) => Math.max(acc, pick(item)), 0)

type MergeCasesDialogProps = {
  opened: boolean
  /** The selected source cases to merge (2+). */
  sources: Case[]
  onClose: () => void
  /** Called after a successful merge, e.g. to clear the list's selection. */
  onMerged?: () => void
}

export function MergeCasesDialog({
  opened,
  sources,
  onClose,
  onMerged,
}: MergeCasesDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // TLP/PAP restrictiveness floors — the max among sources. Used by the render
  // guard (disabling less-restrictive choices). These recompute on every render
  // but are pure over `sources`, so a stable selection yields a stable value.
  const tlpFloor = useMemo(() => maxBy(sources, (c) => c.tlp), [sources])
  const papFloor = useMemo(() => maxBy(sources, (c) => c.pap), [sources])
  // A stable signature of the *selection* (its ids), so the pre-fill effect
  // re-runs only when the selection actually changes — not when a background
  // cases-list refetch hands CasesPage a fresh `sources` array of the same rows.
  const sourceKey = useMemo(() => sources.map((c) => c.id).join(','), [sources])

  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<SeverityChoice>(2)
  const [tlp, setTlp] = useState<TrafficLight>(2)
  const [pap, setPap] = useState<TrafficLight>(2)
  const [assignee, setAssignee] = useState<UserPublic | null>(null)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  // Re-seed the form from the sources only when the dialog opens or the
  // selection identity (`sourceKey`) changes — NOT on every `sources` array
  // identity change, which would wipe the analyst's in-progress edits on any
  // background list refetch. Seed values are computed inside the effect so
  // `sources`' unstable identity never lands in the dependency array.
  useEffect(() => {
    if (!opened) return
    const top = sources.reduce<Case | undefined>(
      (best, c) => (best && best.sev >= c.sev ? best : c),
      undefined,
    )
    setTitle(top?.title ?? '')
    setSeverity((maxBy(sources, (c) => c.sev) || 2) as SeverityChoice)
    setTlp(maxBy(sources, (c) => c.tlp) as TrafficLight)
    setPap(maxBy(sources, (c) => c.pap) as TrafficLight)
    setAssignee(null)
    setSummary('')
    setDescription('')
    // NB: `sources` is intentionally excluded from the deps — `sourceKey`
    // encodes its identity, so a background refetch that only changes the array
    // reference (same rows) doesn't re-seed and wipe in-progress edits.
  }, [opened, sourceKey])

  const mergeMutation = useMutation({
    mutationFn: mergeCases,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: caseKeys.all })
      notifications.show({
        color: 'teal',
        message: `Merged ${sources.length} cases into ${result.id}`,
      })
      onMerged?.()
      onClose()
      void navigate({
        to: '/cases/$caseId/$tab',
        params: { caseId: String(result.numericId), tab: 'details' },
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to merge cases',
      }),
  })

  const submit = () => {
    if (!title.trim()) {
      notifications.show({ color: 'red', message: 'A survivor title is required' })
      return
    }
    mergeMutation.mutate({
      sourceIds: sources.map((c) => c.id),
      case: {
        title,
        description,
        severity,
        tlp,
        pap,
        assigneeId: assignee?.id ?? null,
        summary,
      },
    })
  }

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title="Merge cases"
      size="lg"
      submitLabel="Merge cases"
      loading={mergeMutation.isPending}
      submitDisabled={!title.trim()}
      onSubmit={submit}
    >
      <Stack gap="md">
        <Alert
          color="orange"
          icon={<AlertTriangle size={16} />}
          title="This creates a new survivor case"
        >
          The {sources.length} source cases will become read-only and marked
          Duplicated. Their tasks, observables, comments and attachments reparent
          to the new case.
        </Alert>

        <TextInput
          label={<FieldLabel required>Title</FieldLabel>}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />

        <SegmentedButtons
          label="Severity"
          choices={SEVERITY_CHOICES}
          value={severity}
          onChange={setSeverity}
        />

        <Group grow align="flex-start">
          <SegmentedButtons
            label="TLP"
            choices={TRAFFIC_CHOICES}
            value={tlp}
            onChange={setTlp}
            isDisabled={(v) => v < tlpFloor}
          />
          <SegmentedButtons
            label="PAP"
            choices={TRAFFIC_CHOICES}
            value={pap}
            onChange={setPap}
            isDisabled={(v) => v < papFloor}
          />
        </Group>
        <Text c="dimmed" fz={11}>
          TLP/PAP can't be set less restrictive than the most restrictive source.
        </Text>

        <Stack gap={6}>
          <FieldLabel>Assignee</FieldLabel>
          <Group gap="sm">
            <AssignMenu
              onAssign={setAssignee}
              label={assignee ? 'Change assignee' : 'Assign to'}
            />
            <Text fz={13} c={assignee ? undefined : 'dimmed'}>
              {assignee ? userDisplayName(assignee) : 'Unassigned'}
            </Text>
          </Group>
        </Stack>

        <Textarea
          label={<FieldLabel>Summary</FieldLabel>}
          placeholder="Short executive summary of the merged case…"
          value={summary}
          onChange={(event) => setSummary(event.currentTarget.value)}
          minRows={2}
        />

        <Textarea
          label={<FieldLabel>Description</FieldLabel>}
          placeholder="What happened, scope, working hypothesis… markdown supported"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          minRows={3}
        />
      </Stack>
    </FormDrawer>
  )
}
