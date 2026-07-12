import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createNotifier,
  deleteNotifier,
  notificationRulesQueryOptions,
  notifiersQueryOptions,
  settingsKeys,
  updateNotificationRule,
  updateNotifier,
} from '#/components/pages/settings/settingsQueries'
import type { NotifierPublic } from '#/components/pages/settings/settingsQueries'
import { confirmDelete, Panel } from '#/components/pages/settings/settingsUi'

export function NotificationsPanel() {
  const queryClient = useQueryClient()

  const {
    data: notifierData,
    isPending: notifiersLoading,
  } = useQuery(notifiersQueryOptions())

  const {
    data: ruleData,
    isPending: rulesLoading,
  } = useQuery(notificationRulesQueryOptions())

  const notifiers = notifierData?.items ?? []
  const rules = ruleData?.items ?? []

  const toggleNotifier = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateNotifier(id, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
    onError: () =>
      notifications.show({ color: 'red', message: 'Failed to update notifier' }),
  })

  const toggleRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateNotificationRule(id, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
    onError: () =>
      notifications.show({ color: 'red', message: 'Failed to update rule' }),
  })

  const setRuleNotifiers = useMutation({
    mutationFn: ({ id, notifier_ids }: { id: string; notifier_ids: string[] }) =>
      updateNotificationRule(id, { notifier_ids }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
    onError: () =>
      notifications.show({
        color: 'red',
        message: 'Failed to update rule notifiers',
      }),
  })

  // Options for the per-rule notifier picker; label a notifier by type + target.
  const notifierOptions = notifiers.map((n) => ({
    value: n.id,
    label: `${n.type} — ${n.target || '(no target)'}`,
  }))

  const [showCreate, setShowCreate] = useState(false)
  const [ntype, setNtype] = useState<NotifierPublic['type']>('webhook')
  const [ntarget, setNtarget] = useState('')
  const [nenabled, setNenabled] = useState(true)
  const [nconfig, setNconfig] = useState('{}')
  const [nsecrets, setNsecrets] = useState('{}')
  const [nconfigError, setNconfigError] = useState('')
  const [nsecretsError, setNsecretsError] = useState('')

  const resetCreateForm = () => {
    setNtype('webhook')
    setNtarget('')
    setNenabled(true)
    setNconfig('{}')
    setNsecrets('{}')
    setNconfigError('')
    setNsecretsError('')
  }

  const openCreate = () => {
    resetCreateForm()
    setShowCreate(true)
  }

  const closeCreate = () => {
    setShowCreate(false)
    resetCreateForm()
  }

  const createMutation = useMutation({
    mutationFn: (input: {
      config: Record<string, unknown>
      secrets: Record<string, unknown>
    }) =>
      createNotifier({
        type: ntype,
        target: ntarget || undefined,
        enabled: nenabled,
        config: input.config,
        secrets: input.secrets,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      closeCreate()
      notifications.show({ color: 'teal', message: 'Notifier created' })
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Failed to create notifier'
      notifications.show({ color: 'red', message: msg })
    },
  })

  // Parse/validate the JSON fields in the click handler so validation errors
  // surface inline without ever entering the create request lifecycle.
  const handleCreate = () => {
    let config: Record<string, unknown> = {}
    let secrets: Record<string, unknown> = {}
    let valid = true
    try {
      config = JSON.parse(nconfig)
      setNconfigError('')
    } catch {
      setNconfigError('Invalid JSON')
      valid = false
    }
    try {
      secrets = JSON.parse(nsecrets)
      setNsecretsError('')
    } catch {
      setNsecretsError('Invalid JSON')
      valid = false
    }
    if (!valid) return
    createMutation.mutate({ config, secrets })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotifier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'teal', message: 'Notifier deleted' })
    },
    onError: () =>
      notifications.show({ color: 'red', message: 'Failed to delete notifier' }),
  })

  // Secret rotation. Secrets are write-only (never returned), so the only edit
  // path is to submit a fresh JSON object that replaces them.
  const [rotateFor, setRotateFor] = useState<NotifierPublic | null>(null)
  const [rotateJson, setRotateJson] = useState('{}')
  const [rotateError, setRotateError] = useState('')

  const openRotate = (notifier: NotifierPublic) => {
    setRotateFor(notifier)
    setRotateJson('{}')
    setRotateError('')
  }

  const closeRotate = () => {
    setRotateFor(null)
    setRotateJson('{}')
    setRotateError('')
  }

  const rotateMutation = useMutation({
    mutationFn: (input: { id: string; secrets: Record<string, unknown> }) =>
      updateNotifier(input.id, { secrets: input.secrets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      closeRotate()
      notifications.show({ color: 'teal', message: 'Notifier secrets updated' })
    },
    onError: (error) => {
      const msg =
        error instanceof Error ? error.message : 'Failed to update secrets'
      notifications.show({ color: 'red', message: msg })
    },
  })

  const handleRotate = () => {
    if (!rotateFor) return
    let secrets: Record<string, unknown>
    try {
      secrets = JSON.parse(rotateJson)
      setRotateError('')
    } catch {
      setRotateError('Invalid JSON')
      return
    }
    rotateMutation.mutate({ id: rotateFor.id, secrets })
  }

  return (
    <Stack gap="md">
      <Panel title="Notification rules">
        <Box pos="relative">
          <LoadingOverlay visible={rulesLoading} />
          <Stack gap={0} p={18} pt={6} pb={6}>
            {rules.map((rule) => (
              <Group
                key={rule.id}
                py={12}
                style={{ borderBottom: '1px solid var(--line-soft)' }}
              >
                <Box flex={1}>
                  <Text fz={13} fw={700}>
                    {rule.name}
                  </Text>
                  <Text fz={12} c="var(--muted)">
                    {rule.description}
                  </Text>
                  {rule.enabled && rule.notifier_ids.length === 0 && (
                    <Text fz={11} c="orange.7">
                      Enabled but wired to no notifiers — it will deliver nowhere.
                    </Text>
                  )}
                </Box>
                <MultiSelect
                  w={260}
                  size="xs"
                  data={notifierOptions}
                  value={rule.notifier_ids}
                  placeholder={
                    notifierOptions.length === 0
                      ? 'No notifiers yet'
                      : 'Select notifiers'
                  }
                  aria-label={`${rule.name} notifiers`}
                  disabled={
                    notifierOptions.length === 0 ||
                    (setRuleNotifiers.isPending &&
                      setRuleNotifiers.variables?.id === rule.id)
                  }
                  onChange={(value) =>
                    setRuleNotifiers.mutate({ id: rule.id, notifier_ids: value })
                  }
                  clearable
                  hidePickedOptions
                />
                <Switch
                  checked={rule.enabled}
                  aria-label={`${rule.name} enabled`}
                  onChange={(event) =>
                    toggleRule.mutate({
                      id: rule.id,
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
              </Group>
            ))}
            {!rulesLoading && rules.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No notification rules configured.
              </Text>
            )}
          </Stack>
        </Box>
      </Panel>

      <Panel
        title="Notifiers"
        count={`${notifiers.filter((n) => n.enabled).length} active`}
        action={
          <Button
            variant="default"
            onClick={openCreate}
          >
            + Add notifier
          </Button>
        }
      >
        <Box pos="relative">
          <LoadingOverlay visible={notifiersLoading} />
          <Stack gap={0} p={18} pt={6} pb={6}>
            {notifiers.map((n) => (
              <Group
                key={n.id}
                py={12}
                style={{ borderBottom: '1px solid var(--line-soft)' }}
              >
                <Badge variant="default" color="gray" miw={38}>
                  {n.type.slice(0, 2).toUpperCase()}
                </Badge>
                <Box flex={1}>
                  <Text fz={13} fw={700}>
                    {n.type}
                  </Text>
                  <Text ff="monospace" fz={11} c="var(--faint)">
                    {n.target || '(no target)'}
                  </Text>
                </Box>
                <Badge
                  variant="light"
                  color={n.has_secrets ? 'green' : 'gray'}
                  radius="xl"
                  size="sm"
                >
                  {n.has_secrets ? 'secret set' : 'no secret'}
                </Badge>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => openRotate(n)}
                >
                  {n.has_secrets ? 'Rotate secrets' : 'Set secrets'}
                </Button>
                <Switch
                  checked={n.enabled}
                  aria-label={`${n.type} notifier enabled`}
                  onChange={(event) =>
                    toggleNotifier.mutate({
                      id: n.id,
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
                <Button
                  size="xs"
                  variant="default"
                  color="red"
                  loading={
                    deleteMutation.isPending && deleteMutation.variables === n.id
                  }
                  onClick={() =>
                    confirmDelete({
                      title: 'Delete notifier',
                      message: `Delete the ${n.type} notifier${n.target ? ` (${n.target})` : ''}? Notification rules using it will stop delivering here.`,
                      onConfirm: () => deleteMutation.mutate(n.id),
                    })
                  }
                >
                  Delete
                </Button>
              </Group>
            ))}
            {!notifiersLoading && notifiers.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No notifiers configured.
              </Text>
            )}
          </Stack>
        </Box>
      </Panel>

      <Panel title="Message template" count="handlebars">
        <Text c="dimmed" p={18}>
          Message templates are managed via the notifier config. Create a notifier
          with the desired template in its config field.
        </Text>
      </Panel>

      <Modal
        opened={showCreate}
        onClose={closeCreate}
        title="Add notifier"
      >
        <Stack gap="md">
          <Select
            label="Type"
            data={[
              { value: 'slack', label: 'Slack' },
              { value: 'email', label: 'Email' },
              { value: 'webhook', label: 'Webhook' },
              { value: 'kafka', label: 'Kafka' },
            ]}
            value={ntype}
            onChange={(v) => setNtype(v as NotifierPublic['type'])}
            required
          />
          <TextInput
            label="Target"
            description="URL, email address, or topic"
            value={ntarget}
            onChange={(e) => setNtarget(e.currentTarget.value)}
          />
          <Checkbox
            label="Enabled"
            checked={nenabled}
            onChange={(e) => setNenabled(e.currentTarget.checked)}
          />
          <Textarea
            label="Config"
            description="JSON object"
            value={nconfig}
            onChange={(e) => setNconfig(e.currentTarget.value)}
            error={nconfigError}
            minRows={3}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
          />
          <Textarea
            label="Secrets"
            description="JSON object"
            value={nsecrets}
            onChange={(e) => setNsecrets(e.currentTarget.value)}
            error={nsecretsError}
            minRows={3}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={createMutation.isPending}
              onClick={handleCreate}
            >
              Create notifier
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={rotateFor !== null}
        onClose={closeRotate}
        title={
          rotateFor
            ? `${rotateFor.has_secrets ? 'Rotate' : 'Set'} secrets — ${rotateFor.type}`
            : 'Secrets'
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Secrets are write-only and never shown. Submitting replaces the
            notifier's stored secrets with the JSON below.
          </Text>
          <Textarea
            label="Secrets"
            description="JSON object"
            value={rotateJson}
            onChange={(e) => setRotateJson(e.currentTarget.value)}
            error={rotateError}
            minRows={4}
            styles={{
              input: {
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 12,
              },
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeRotate}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={rotateMutation.isPending}
              onClick={handleRotate}
            >
              Save secrets
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
