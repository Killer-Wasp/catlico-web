/**
 * PluginPickerDialog — a reusable chooser for "which analyzers to run".
 *
 * It fetches the runnable-plugins list (server-filtered to plugins that will
 * actually enrich) and lets the analyst tick a subset, toggle a force re-run,
 * and hit Run. It owns NO dispatch logic: on Run it hands the chosen
 * `{ pluginIds, force }` back via `onRun` and the caller fans out to whichever
 * entities it targets (one observable in the detail drawer, many on the bulk
 * page, a case later). That keeps the picker identical across every caller.
 *
 * The dialog deliberately does NOT close itself on Run — it stays open with the
 * Run button in its `loading` state (`isRunning`) so a long bulk fan-out shows
 * in-dialog progress. The CALLER closes it once its mutation settles.
 */
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { runnablePluginsQueryOptions } from './plugins'

export type PluginPickerSelection = { pluginIds: string[]; force: boolean }

export type PluginPickerDialogProps = {
  /** Whether the dialog is visible. */
  opened: boolean
  /** Called when the dialog should close (Cancel, or after Run). */
  onClose: () => void
  /** Capability filter for the runnable list. Defaults to `enrichment`. */
  capability?: string
  /**
   * What kind of plugin is being run — drives the visible copy (title,
   * loading/error/empty states) as "Run {noun}s" / "runnable {noun}s". Defaults
   * to `analyzer` (the enrichment picker); pass `responder` for the responder
   * picker. Purely cosmetic — the actual list is filtered by `capability`.
   */
  noun?: string
  /** Optional context line under the title, e.g. "Run on 3 observables". */
  contextLabel?: string
  /** True while the caller's fan-out is in flight — keeps Run busy/disabled. */
  isRunning?: boolean
  /** Receives the chosen plugins + force flag; the caller owns the dispatch. */
  onRun: (selection: PluginPickerSelection) => void
}

export function PluginPickerDialog({
  opened,
  onClose,
  capability = 'enrichment',
  noun = 'analyzer',
  contextLabel,
  isRunning = false,
  onRun,
}: PluginPickerDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [force, setForce] = useState(false)

  const {
    data: plugins,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...runnablePluginsQueryOptions(capability),
    enabled: opened,
  })

  // Reset the picker each time it closes so a re-open starts clean.
  useEffect(() => {
    if (!opened) {
      setSelected(new Set())
      setForce(false)
    }
  }, [opened])

  const runnable = plugins ?? []
  const allSelected = runnable.length > 0 && selected.size === runnable.length
  const someSelected = selected.size > 0 && !allSelected

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((current) =>
      current.size === runnable.length
        ? new Set()
        : new Set(runnable.map((p) => p.id)),
    )
  }

  const run = () => {
    if (selected.size === 0) return
    // Hand the selection to the caller but stay open — the caller drives the
    // dispatch and closes us (via `onClose`) when its mutation settles, so the
    // Run spinner (`isRunning`) is visible for the duration of the fan-out.
    onRun({ pluginIds: [...selected], force })
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Run ${noun}s`}>
      <Stack gap="md">
        {contextLabel ? (
          <Text fz="sm" c="dimmed">
            {contextLabel}
          </Text>
        ) : null}

        {isPending ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text fz="sm" c="dimmed">
              Loading runnable {noun}s…
            </Text>
          </Group>
        ) : isError ? (
          <Alert color="red" variant="light">
            <Group justify="space-between" wrap="nowrap">
              <Text fz="sm">Couldn’t load runnable {noun}s.</Text>
              <Button size="xs" variant="default" onClick={() => refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        ) : runnable.length === 0 ? (
          <Text fz="sm" c="dimmed">
            No runnable {noun}s. Enable and configure a plugin on a healthy
            runner first.
          </Text>
        ) : (
          <>
            <Checkbox
              label="Select all"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
            />
            <Divider />
            <Stack gap="sm">
              {runnable.map((plugin) => (
                <Checkbox
                  key={plugin.id}
                  checked={selected.has(plugin.id)}
                  onChange={(e) => toggleOne(plugin.id, e.currentTarget.checked)}
                  label={
                    <Stack gap={2}>
                      <Text fz="sm" fw={600}>
                        {plugin.name}
                      </Text>
                      {plugin.description ? (
                        <Text fz="xs" c="dimmed">
                          {plugin.description}
                        </Text>
                      ) : null}
                    </Stack>
                  }
                />
              ))}
            </Stack>
          </>
        )}

        <Divider />
        <Checkbox
          label="Force re-run (bypass dedup of fresh results)"
          checked={force}
          onChange={(e) => setForce(e.currentTarget.checked)}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0}
            loading={isRunning}
            onClick={run}
          >
            Run
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
