import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Modal,
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
  notificationRulesQueryOptions,
  notifiersQueryOptions,
  settingsKeys,
  updateNotificationRule,
  updateNotifier,
  type NotifierPublic,
} from '#/components/pages/settings/settingsQueries'
import { Panel } from '#/components/pages/settings/settingsUi'

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
    mutationFn: async () => {
      const errors: string[] = []
      let config: Record<string, unknown> = {}
      let secrets: Record<string, unknown> = {}
      try {
        config = JSON.parse(nconfig)
        setNconfigError('')
      } catch {
        setNconfigError('Invalid JSON')
        errors.push('config')
      }
      try {
        secrets = JSON.parse(nsecrets)
        setNsecretsError('')
      } catch {
        setNsecretsError('Invalid JSON')
        errors.push('secrets')
      }
      if (errors.length > 0) throw new Error(`Invalid JSON in: ${errors.join(', ')}`)
      return createNotifier({
        type: ntype,
        target: ntarget || undefined,
        enabled: nenabled,
        config,
        secrets,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      closeCreate()
      notifications.show({ color: 'teal', message: 'Notifier created' })
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Failed to create notifier'
      if (!msg.startsWith('Invalid JSON')) {
        notifications.show({ color: 'red', message: msg })
      }
    },
  })

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
                </Box>
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
            onChange={(v) => v && setNtype(v as NotifierPublic['type'])}
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
              onClick={() => createMutation.mutate()}
            >
              Create notifier
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
