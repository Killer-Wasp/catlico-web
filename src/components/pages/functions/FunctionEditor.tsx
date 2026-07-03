import classes from '#/components/Cases/CasesPage.module.css'
import {
  ActionIcon,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { X } from 'lucide-react'
import type { DraftUpdater, FunctionAutomation } from './model'
import { PROFILE_OPTIONS } from './model'
import { FuncPanel, PageHead } from './Panels'
import { RunHistory } from './RunHistory'
import { TriggerConfig } from './TriggerConfig'

export function FunctionEditor({
  draft,
  setDraft,
  onBack,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  draft: FunctionAutomation
  setDraft: DraftUpdater
  onBack: () => void
  onSave: () => void
  /** Delete this function; only offered when editing an existing one. */
  onDelete?: () => void
  saving: boolean
  deleting?: boolean
}) {
  const title = draft.id ? 'Edit function' : 'New function'
  const stamp = draft.id
    ? `${draft.runCount} runs · ${draft.errorCount} errors`
    : 'create an automation'

  return (
    <Box className={classes.page} maw={1080} mx="auto">
      <Group gap={8} mb="md">
        <Button
          variant="transparent"
          color="gray"
          p={0}
          h="auto"
          onClick={onBack}
        >
          ← Functions
        </Button>
        <Text c="dimmed">/</Text>
        <Text ff="monospace" fz="xs" c="dimmed">
          {draft.name || 'New'}
        </Text>
      </Group>

      <PageHead
        title={title}
        stamp={stamp}
        actions={
          <>
            {draft.id && onDelete ? (
              <Button
                variant="light"
                color="red"
                loading={deleting}
                onClick={onDelete}
              >
                Delete
              </Button>
            ) : null}
            <Button variant="default" onClick={onBack}>
              Cancel
            </Button>
            <Button color="orange" loading={saving} onClick={onSave}>
              Save function
            </Button>
          </>
        }
      />

      <Box className={classes.functionEditLayout}>
        <Stack gap="md">
          <FuncPanel title="Basics">
            <Box p="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Name"
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, name: event.currentTarget.value }))
                  }
                  placeholder="e.g. Auto-enrich new IP observables"
                />
                <Select
                  label="Runtime"
                  data={['javascript', 'python']}
                  value={draft.runtime}
                  onChange={(value) =>
                    setDraft((c) => ({
                      ...c,
                      runtime: value ?? 'javascript',
                    }))
                  }
                />
              </SimpleGrid>
              <Textarea
                mt="md"
                label="Description"
                value={draft.description}
                minRows={3}
                onChange={(event) =>
                  setDraft((c) => ({
                    ...c,
                    description: event.currentTarget.value,
                  }))
                }
              />
            </Box>
          </FuncPanel>

          <FuncPanel title="Code" badge="ctx SDK in scope">
            <Stack p="lg">
              <Textarea
                aria-label="Function code"
                value={draft.code}
                minRows={14}
                spellCheck={false}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, code: event.currentTarget.value }))
                }
                styles={{
                  input: {
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 13,
                    lineHeight: 1.45,
                  },
                }}
              />
              <Paper
                withBorder
                radius="md"
                p="md"
                mih={88}
                bg="gray.0"
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 13,
                }}
              >
                <Text c="dimmed">
                  Test-run sandbox is not available yet. Functions must be
                  triggered from their configured source.
                </Text>
              </Paper>
            </Stack>
          </FuncPanel>

          <RunHistory runs={draft.runs} />
        </Stack>

        <Stack gap="md">
          <FuncPanel title="Trigger">
            <Stack p="lg">
              <SegmentedControl
                data={[
                  { value: 'scheduled', label: 'SCHEDULED' },
                  { value: 'event', label: 'EVENT' },
                  { value: 'manual', label: 'MANUAL' },
                  { value: 'api', label: 'API' },
                ]}
                value={draft.trigger}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    trigger: value,
                    triggerConfig:
                      value === 'event'
                        ? { condition: current.triggerConfig.condition ?? '' }
                        : value === 'scheduled'
                          ? { cron: current.triggerConfig.cron ?? '0 8 * * *' }
                          : value === 'manual'
                            ? {
                                entities: current.triggerConfig.entities ?? [
                                  'cases',
                                  'observables',
                                ],
                              }
                            : {},
                  }))
                }
                size="xs"
              />
              <TriggerConfig draft={draft} setDraft={setDraft} />
            </Stack>
          </FuncPanel>

          <FuncPanel title="Execution">
            <Stack p="lg">
              <Select
                label="Runs as profile"
                data={PROFILE_OPTIONS}
                value={draft.profile}
                onChange={(value) =>
                  setDraft((c) => ({ ...c, profile: value ?? 'analyst' }))
                }
              />
              <TextInput
                label="Timeout (ms)"
                type="number"
                value={String(draft.timeout)}
                onChange={(event) =>
                  setDraft((c) => ({
                    ...c,
                    timeout: Number(event.currentTarget.value) || 15000,
                  }))
                }
              />
              <TextInput
                label="Egress allowlist"
                value={draft.egress}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, egress: event.currentTarget.value }))
                }
                description="RFC1918 + link-local always blocked"
              />
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box>
                  <Text fw={700} size="sm">
                    Require 4-eyes approval
                  </Text>
                  <Text c="dimmed" size="xs">
                    a second admin must approve before enabling
                  </Text>
                </Box>
                <Switch
                  checked={draft.approval}
                  onChange={(event) =>
                    setDraft((c) => ({
                      ...c,
                      approval: event.currentTarget.checked,
                    }))
                  }
                  aria-label="Require 4-eyes approval"
                />
              </Group>
            </Stack>
          </FuncPanel>

          <FuncPanel title="Secrets" badge="vault refs">
            <Stack p="lg" gap="sm">
              {draft.secrets.length ? (
                draft.secrets.map((secret) => (
                  <Group key={secret} justify="space-between" wrap="nowrap">
                    <Code>{secret}</Code>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      aria-label={`Remove ${secret}`}
                      onClick={() =>
                        setDraft((c) => ({
                          ...c,
                          secrets: c.secrets.filter((s) => s !== secret),
                        }))
                      }
                    >
                      <X size={16} />
                    </ActionIcon>
                  </Group>
                ))
              ) : (
                <Text c="dimmed" size="sm">
                  No secrets referenced.
                </Text>
              )}
              <Divider />
              <Button
                variant="default"
                onClick={() =>
                  setDraft((c) => ({
                    ...c,
                    secrets: [...c.secrets, `SECRET_${c.secrets.length + 1}`],
                  }))
                }
              >
                + Add secret ref
              </Button>
            </Stack>
          </FuncPanel>
        </Stack>
      </Box>
    </Box>
  )
}
