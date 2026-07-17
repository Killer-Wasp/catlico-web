import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  MultiSelect,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { FormDrawer } from '#/components/ui/FormDrawer'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
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
import type {
  NotifierCreateInput,
  NotifierPublic,
  NotifierUpdateInput,
} from '#/components/pages/settings/settingsQueries'
import { confirmDelete, Panel } from '#/components/pages/settings/settingsUi'

/** Notifier types the create form can produce. Kafka is intentionally omitted. */
type CreatableNotifierType = 'slack' | 'webhook' | 'email'

/** Basic per-entry email check for the email notifier's recipient list. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Trim, drop blanks, then validate each recipient. Returns the cleaned list, or
 * an error message when the list is empty or an entry is not a valid address.
 */
function validateRecipients(
  raw: string[],
): { recipients: string[] } | { error: string } {
  const recipients = raw.map((r) => r.trim()).filter(Boolean)
  if (recipients.length === 0) {
    return { error: 'Add at least one recipient email address.' }
  }
  const invalid = recipients.find((r) => !EMAIL_RE.test(r))
  if (invalid) {
    return { error: `"${invalid}" is not a valid email address.` }
  }
  return { recipients }
}

type FastAPIError = {
  detail?: { loc: (string | number)[]; msg: string }[]
}

/**
 * Map a server 422 onto per-field error setters. FastAPI reports the offending
 * field as the last element of each `loc`; anything we can't route to a field
 * falls through to `fallback` (a toast). Mirrors the plugin-config secret flow.
 */
function applyValidationError(
  error: unknown,
  setters: Partial<Record<string, (msg: string) => void>>,
  fallback: (msg: string) => void,
): void {
  if (isHTTPError(error) && error.response.status === 422) {
    const detail = (error as { data?: FastAPIError }).data?.detail ?? []
    let mapped = false
    for (const d of detail) {
      const field = d.loc[d.loc.length - 1]
      const set = typeof field === 'string' ? setters[field] : undefined
      if (set) {
        set(d.msg)
        mapped = true
      }
    }
    if (mapped) return
    fallback(detail[0]?.msg ?? 'Validation failed')
    return
  }
  fallback(error instanceof Error ? error.message : 'Request failed')
}

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
    label: `${n.type} — ${n.target || '(no label)'}`,
  }))

  // ── Create ────────────────────────────────────────────────────────────────
  // Two shapes, branched on type:
  //  • slack/webhook — the destination URL is a write-only secret sent as
  //    `secrets.url` (never as the plaintext `target`); webhooks may add a
  //    signing secret. `target` is only an optional display label.
  //  • email — recipients are plain config (`config.recipients`), NOT a secret,
  //    and there is no URL at all.
  const [showCreate, setShowCreate] = useState(false)
  const [ntype, setNtype] = useState<CreatableNotifierType>('slack')
  const [nurl, setNurl] = useState('')
  const [nlabel, setNlabel] = useState('')
  const [nsigningSecret, setNsigningSecret] = useState('')
  const [nrecipients, setNrecipients] = useState<string[]>([])
  const [nenabled, setNenabled] = useState(true)
  const [nurlError, setNurlError] = useState('')
  const [nsigningError, setNsigningError] = useState('')
  const [nrecipientsError, setNrecipientsError] = useState('')

  const resetCreateForm = () => {
    setNtype('slack')
    setNurl('')
    setNlabel('')
    setNsigningSecret('')
    setNrecipients([])
    setNenabled(true)
    setNurlError('')
    setNsigningError('')
    setNrecipientsError('')
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
    mutationFn: (input: NotifierCreateInput) => createNotifier(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      closeCreate()
      notifications.show({ color: 'teal', message: 'Notifier created' })
    },
    onError: (error) =>
      applyValidationError(
        error,
        {
          url: setNurlError,
          signing_secret: setNsigningError,
          recipients: setNrecipientsError,
        },
        (message) => notifications.show({ color: 'red', message }),
      ),
  })

  const handleCreate = () => {
    const target = nlabel.trim() || undefined
    if (ntype === 'email') {
      setNrecipientsError('')
      const result = validateRecipients(nrecipients)
      if ('error' in result) {
        setNrecipientsError(result.error)
        return
      }
      // Email has NO url/secrets — the list rides in plain config.
      createMutation.mutate({
        type: 'email',
        target,
        enabled: nenabled,
        config: { recipients: result.recipients },
      })
      return
    }
    setNurlError('')
    setNsigningError('')
    if (!nurl.trim()) {
      setNurlError('Destination URL is required')
      return
    }
    const secrets: Record<string, unknown> = { url: nurl.trim() }
    if (ntype === 'webhook' && nsigningSecret.trim()) {
      secrets.signing_secret = nsigningSecret.trim()
    }
    createMutation.mutate({ type: ntype, target, enabled: nenabled, secrets })
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

  // ── Edit / rotate ───────────────────────────────────────────────────────────
  // The URL is never returned, so there is nothing to prefill. Editing shows the
  // label + a "secrets configured" flag and reveals a fresh write-only URL input
  // on demand. Secret-write semantics: a submitted string replaces, an omitted
  // key keeps, and `null` deletes (used to remove a webhook signing secret).
  const [editFor, setEditFor] = useState<NotifierPublic | null>(null)
  const [showUrlField, setShowUrlField] = useState(false)
  const [editUrl, setEditUrl] = useState('')
  const [editUrlError, setEditUrlError] = useState('')
  const [editSigningSecret, setEditSigningSecret] = useState('')
  const [editSigningError, setEditSigningError] = useState('')
  const [removeSigning, setRemoveSigning] = useState(false)
  // Email recipients ARE returned (plain config), so unlike the URL they can be
  // prefilled and edited in place.
  const [editRecipients, setEditRecipients] = useState<string[]>([])
  const [editRecipientsError, setEditRecipientsError] = useState('')

  const openEdit = (notifier: NotifierPublic) => {
    setEditFor(notifier)
    setShowUrlField(false)
    setEditUrl('')
    setEditUrlError('')
    setEditSigningSecret('')
    setEditSigningError('')
    setRemoveSigning(false)
    setEditRecipients(notifier.config.recipients ?? [])
    setEditRecipientsError('')
  }

  const closeEdit = () => {
    setEditFor(null)
    setShowUrlField(false)
    setEditUrl('')
    setEditUrlError('')
    setEditSigningSecret('')
    setEditSigningError('')
    setRemoveSigning(false)
    setEditRecipients([])
    setEditRecipientsError('')
  }

  const editMutation = useMutation({
    mutationFn: (input: { id: string; patch: NotifierUpdateInput }) =>
      updateNotifier(input.id, input.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      closeEdit()
      notifications.show({ color: 'teal', message: 'Notifier updated' })
    },
    onError: (error) =>
      applyValidationError(
        error,
        {
          url: setEditUrlError,
          signing_secret: setEditSigningError,
          recipients: setEditRecipientsError,
        },
        (message) => notifications.show({ color: 'red', message }),
      ),
  })

  const handleEdit = () => {
    if (!editFor) return
    if (editFor.type === 'email') {
      setEditRecipientsError('')
      const result = validateRecipients(editRecipients)
      if ('error' in result) {
        setEditRecipientsError(result.error)
        return
      }
      editMutation.mutate({
        id: editFor.id,
        patch: { config: { recipients: result.recipients } },
      })
      return
    }
    setEditUrlError('')
    setEditSigningError('')
    const secrets: Record<string, unknown> = {}
    if (showUrlField) {
      if (!editUrl.trim()) {
        setEditUrlError('Enter a URL, or cancel to keep the current one')
        return
      }
      secrets.url = editUrl.trim()
    }
    if (editFor.type === 'webhook') {
      // Removal wins over a typed value: if the user checks "remove" we send
      // null (delete) even if they had also typed a replacement, so the intent
      // to clear is never silently overridden.
      if (removeSigning) {
        secrets.signing_secret = null
      } else if (editSigningSecret.trim()) {
        secrets.signing_secret = editSigningSecret.trim()
      }
    }
    if (Object.keys(secrets).length === 0) {
      notifications.show({ color: 'blue', message: 'No changes to save' })
      return
    }
    editMutation.mutate({ id: editFor.id, patch: { secrets } })
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
                  {/* Server-derived display label — never the destination URL. */}
                  <Text ff="monospace" fz={11} c="var(--faint)">
                    {n.target || '(no label)'}
                  </Text>
                </Box>
                <Badge
                  variant="light"
                  color={n.has_secrets ? 'green' : 'gray'}
                  radius="xl"
                  size="sm"
                >
                  {n.has_secrets ? 'Secrets configured' : 'No secrets'}
                </Badge>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => openEdit(n)}
                >
                  Edit
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
                      confirmLabel: 'Delete notifier',
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
          Message templates are managed per notifier by the delivery backend.
          Formatting for each channel is handled server-side.
        </Text>
      </Panel>

      <FormDrawer
        opened={showCreate}
        onClose={closeCreate}
        title="Add notifier"
        submitLabel="Create notifier"
        loading={createMutation.isPending}
        onSubmit={handleCreate}
      >
        <Stack gap="md">
          <Select
            label="Type"
            data={[
              { value: 'slack', label: 'Slack' },
              { value: 'webhook', label: 'Webhook' },
              { value: 'email', label: 'Email' },
            ]}
            value={ntype}
            onChange={(v) => setNtype(v ?? 'slack')}
            allowDeselect={false}
            required
          />
          {ntype === 'email' ? (
            <TagsInput
              label="Recipients"
              description="Press Enter or comma after each address. At least one is required."
              placeholder="ops@example.com"
              value={nrecipients}
              error={nrecipientsError}
              onChange={(v) => {
                setNrecipients(v)
                if (nrecipientsError) setNrecipientsError('')
              }}
              splitChars={[',', ' ']}
              clearable
            />
          ) : (
            <>
              <TextInput
                label="Destination URL"
                description="Stored as a write-only secret — it is never shown again."
                placeholder="https://…"
                value={nurl}
                error={nurlError}
                onChange={(e) => {
                  setNurl(e.currentTarget.value)
                  if (nurlError) setNurlError('')
                }}
                required
              />
              {ntype === 'webhook' && (
                <PasswordInput
                  label="Signing secret"
                  description="Optional. Used to sign webhook payloads."
                  value={nsigningSecret}
                  error={nsigningError}
                  onChange={(e) => {
                    setNsigningSecret(e.currentTarget.value)
                    if (nsigningError) setNsigningError('')
                  }}
                />
              )}
            </>
          )}
          <TextInput
            label="Label"
            description={
              ntype === 'email'
                ? 'Optional display name for this notifier.'
                : 'Optional display name. Derived from the URL if left blank.'
            }
            value={nlabel}
            onChange={(e) => setNlabel(e.currentTarget.value)}
          />
          <Checkbox
            label="Enabled"
            checked={nenabled}
            onChange={(e) => setNenabled(e.currentTarget.checked)}
          />
        </Stack>
      </FormDrawer>

      <FormDrawer
        opened={editFor !== null}
        onClose={closeEdit}
        title={editFor ? `Edit ${editFor.type} notifier` : 'Edit notifier'}
        submitLabel="Save changes"
        loading={editMutation.isPending}
        onSubmit={handleEdit}
      >
        {editFor && (
          <Stack gap="md">
            <Box>
              <Text fz={12} c="dimmed">
                Label
              </Text>
              <Text ff="monospace" fz={13}>
                {editFor.target || '(no label)'}
              </Text>
            </Box>
            {editFor.type === 'email' ? (
              // Email recipients are plain config, not a write-only secret, so
              // they are prefilled and edited directly — no URL / rotate copy.
              <TagsInput
                label="Recipients"
                description="Press Enter or comma after each address. At least one is required."
                placeholder="ops@example.com"
                value={editRecipients}
                error={editRecipientsError}
                onChange={(v) => {
                  setEditRecipients(v)
                  if (editRecipientsError) setEditRecipientsError('')
                }}
                splitChars={[',', ' ']}
                clearable
              />
            ) : (
              <>
                <Badge
                  variant="light"
                  color={editFor.has_secrets ? 'green' : 'gray'}
                  radius="xl"
                  size="sm"
                  w="fit-content"
                >
                  {editFor.has_secrets
                    ? 'Secrets configured'
                    : 'No secrets stored'}
                </Badge>
                <Text size="sm" c="dimmed">
                  The destination URL is write-only and never shown. Change it by
                  entering a fresh URL below; leave it untouched to keep the
                  current one.
                </Text>

                {showUrlField ? (
                  <TextInput
                    label="Destination URL"
                    description="Replaces the stored URL."
                    placeholder="https://…"
                    value={editUrl}
                    error={editUrlError}
                    onChange={(e) => {
                      setEditUrl(e.currentTarget.value)
                      if (editUrlError) setEditUrlError('')
                    }}
                    autoFocus
                  />
                ) : (
                  <Button
                    variant="default"
                    w="fit-content"
                    onClick={() => setShowUrlField(true)}
                  >
                    Change URL
                  </Button>
                )}

                {editFor.type === 'webhook' && (
                  <Stack gap={4}>
                    <PasswordInput
                      label="Signing secret"
                      description={
                        editFor.has_secrets
                          ? 'Leave blank to keep the stored signing secret.'
                          : 'Optional. Used to sign webhook payloads.'
                      }
                      value={editSigningSecret}
                      error={editSigningError}
                      disabled={removeSigning}
                      onChange={(e) => {
                        setEditSigningSecret(e.currentTarget.value)
                        if (editSigningError) setEditSigningError('')
                      }}
                    />
                    <Checkbox
                      label="Remove stored signing secret"
                      checked={removeSigning}
                      onChange={(e) => setRemoveSigning(e.currentTarget.checked)}
                    />
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </FormDrawer>
    </Stack>
  )
}
