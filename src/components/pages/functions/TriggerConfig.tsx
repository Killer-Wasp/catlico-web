import { Stack, Switch, Text, TextInput } from '@mantine/core'
import type { DraftUpdater, FunctionAutomation } from './model'

export function TriggerConfig({
  draft,
  setDraft,
}: {
  draft: FunctionAutomation
  setDraft: DraftUpdater
}) {
  if (draft.trigger === 'scheduled') {
    return (
      <TextInput
        label="Cron expression"
        value={String(draft.triggerConfig.cron ?? '0 8 * * *')}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            triggerConfig: { cron: event.currentTarget.value },
          }))
        }
        description="min hour dom mon dow · UTC"
      />
    )
  }
  if (draft.trigger === 'manual') {
    const entitiesValue = draft.triggerConfig.entities
    const entities = Array.isArray(entitiesValue)
      ? entitiesValue.filter((entity): entity is string => typeof entity === 'string')
      : []
    return (
      <Stack gap={6}>
        <Text size="sm" fw={600}>
          Show "Run" on
        </Text>
        {['cases', 'alerts', 'observables', 'tasks'].map((entity) => (
          <Switch
            key={entity}
            label={entity}
            checked={entities.includes(entity)}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                triggerConfig: {
                  entities: event.currentTarget.checked
                    ? [...entities, entity]
                    : entities.filter((e) => e !== entity),
                },
              }))
            }}
          />
        ))}
      </Stack>
    )
  }
  if (draft.trigger === 'api') {
    return (
      <TextInput
        label="Webhook URL"
        value={`https://catlico.origin/api/v1/fn/${draft.id || 'new'}/trigger`}
        readOnly
        description="POST with API key · payload becomes event"
        styles={{
          input: { fontFamily: 'var(--mantine-font-family-monospace)' },
        }}
      />
    )
  }
  return (
    <TextInput
      label="Fires when"
      value={String(draft.triggerConfig.condition ?? '')}
      onChange={(event) =>
        setDraft((current) => ({
          ...current,
          triggerConfig: { condition: event.currentTarget.value },
        }))
      }
      description="FilteredEvent predicate"
    />
  )
}
