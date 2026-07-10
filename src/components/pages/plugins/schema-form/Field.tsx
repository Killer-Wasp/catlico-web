/**
 * Field.tsx — schema-type-aware Mantine control renderer.
 *
 * Maps each `FieldType` to the appropriate Mantine input. Follows the plan:
 *   string → TextInput
 *   multiline → Textarea
 *   integer/float/number → NumberInput
 *   boolean → Switch
 *   string + choices → Select
 *   array + choices → MultiSelect
 *   array (no choices) → TagsInput
 *   cron → TextInput + fire-time preview
 *   secret → PasswordInput + stored badge + "Clear" action
 *   environment → read-only TextInput + lock icon
 */

import {
  Box,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import type { PluginConfigParam } from '#/components/Plugins/plugins.types'
import { describeFieldType } from './buildForm'
import type { FieldType } from './buildForm'

// ── Exported props type ─────────────────────────────────────────────────────

export type FieldProps = {
  param: PluginConfigParam
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  /** Whether the field has been modified from its initial value. */
  dirty?: boolean
  /** For secret fields: whether the server has a stored secret for this param. */
  storedSecret?: boolean
  /** Called when the user clears a stored secret. */
  onClearSecret?: () => void
  /** When true, the field is read-only (runner health gate). */
  disabled?: boolean
}

// ── Fire-time preview (cron helper) ─────────────────────────────────────────

function parseCronExpr(_expr: string): Date[] | null {
  // Stub: server-side cron evaluation is not available client-side.
  // This preview is a placeholder that could be replaced with a cron parser
  // (e.g., cronstrue) when the server provides the firing schedule.
  // For now, return null to hide the preview.
  return null
}

function CronPreview({ value }: { value: string }) {
  const times = useMemo(() => parseCronExpr(value), [value])
  if (!times || times.length === 0) return null

  return (
    <Stack gap={2}>
      <Text component="span" fz={11} c="dimmed">
        Next {times.length > 1 ? `${times.length} fire times` : 'fire time'}:
      </Text>
      {times.map((t, i) => (
        <Text key={i} component="span" fz={11} ff="monospace" c="dimmed">
          {t.toLocaleString()}
        </Text>
      ))}
    </Stack>
  )
}

// ── Renderers per field type ────────────────────────────────────────────────

function renderField(
  fieldType: FieldType,
  { param, value, onChange, error, storedSecret, onClearSecret }: FieldProps,
) {
  const label = param.name
  const description = param.description
  const required = param.required ?? false
  const stringValue = String(value ?? '')
  const numberValue =
    typeof value === 'number' || typeof value === 'string'
      ? value === '' || value === undefined
        ? ''
        : Number(value)
      : ''

  switch (fieldType) {
    case 'environment':
      return (
        <TextInput
          label={label}
          description={description}
          value={stringValue}
          readOnly
          rightSection={
            <Tooltip label="Set by environment" position="top" withArrow>
              <Box component="span" style={{ display: 'flex', alignItems: 'center' }}>
                <Lock size={14} />
              </Box>
            </Tooltip>
          }
        />
      )

    case 'secret':
      return (
        <PasswordInput
          label={label}
          description={description}
          value={stringValue}
          error={error}
          required={required}
          placeholder={storedSecret ? 'Leave blank to keep stored secret' : ''}
          rightSection={
            storedSecret ? (
              <Group gap={4} wrap="nowrap">
                <Text component="span" fz={11} c="green" fw={500}>
                  Stored
                </Text>
                {onClearSecret && (
                  <Text
                    component="span"
                    fz={11}
                    c="red"
                    fw={500}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={onClearSecret}
                  >
                    Clear
                  </Text>
                )}
              </Group>
            ) : null
          }
          rightSectionWidth={storedSecret ? 70 : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )

    case 'cron': {
      return (
        <Stack gap={4}>
          <TextInput
            label={label}
            description={description}
            value={stringValue}
            error={error}
            required={required}
            placeholder="* * * * *"
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <CronPreview value={stringValue} />
        </Stack>
      )
    }

    case 'boolean':
      return (
        <Switch
          label={label}
          description={description}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      )

    case 'number':
      return (
        <NumberInput
          label={label}
          description={description}
          value={numberValue}
          error={error}
          required={required}
          onChange={(val) => onChange(val)}
        />
      )

    case 'multiline':
      return (
        <Textarea
          label={label}
          description={description}
          value={stringValue}
          error={error}
          required={required}
          minRows={3}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )

    case 'select':
      return (
        <Select
          label={label}
          description={description}
          data={param.choices ?? []}
          value={stringValue || null}
          error={error}
          required={required}
          clearable={!required}
          onChange={(val) => onChange(val ?? '')}
        />
      )

    case 'multiselect':
      return (
        <MultiSelect
          label={label}
          description={description}
          data={param.choices ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          error={error}
          onChange={(val) => onChange(val)}
        />
      )

    case 'tags':
      return (
        <TagsInput
          label={label}
          description={description}
          value={Array.isArray(value) ? (value as string[]) : []}
          error={error}
          onChange={(val) => onChange(val)}
        />
      )

    case 'text':
    default:
      return (
        <TextInput
          label={label}
          description={description}
          value={stringValue}
          error={error}
          required={required}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )
  }
}

// ── Public component ────────────────────────────────────────────────────────

export function SchemaField(props: FieldProps) {
  const fieldType = describeFieldType(props.param)
  return renderField(fieldType, props)
}
