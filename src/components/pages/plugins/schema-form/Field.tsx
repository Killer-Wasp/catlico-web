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

/**
 * Parse a cron expression and return the next 3 fire times.
 * Returns null if the expression is invalid.
 * Supports standard cron format: minute hour day-of-month month day-of-week
 */
function parseCronExpr(expr: string): Date[] | null {
  if (!expr || typeof expr !== 'string') return null

  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minStr, hourStr, dayStr, monthStr, dowStr] = parts

  try {
    // Parse each field; validate ranges
    const minutes = parseField(minStr, 0, 59)
    const hours = parseField(hourStr, 0, 23)
    const days = parseField(dayStr, 1, 31)
    const months = parseField(monthStr, 1, 12)
    const dows = parseField(dowStr, 0, 6)

    if (!minutes || !hours || !days || !months || !dows) return null

    // Vixie-cron day semantics (matches the server's croniter): when BOTH
    // day-of-month and day-of-week are restricted, a time matches if EITHER
    // does; when only one is restricted, it alone decides.
    const bothDaysRestricted = dayStr !== '*' && dowStr !== '*'

    // Generate next 3 fire times
    const times: Date[] = []
    const startTime = new Date()
    startTime.setSeconds(0, 0)
    startTime.setMinutes(startTime.getMinutes() + 1)
    const baseYear = startTime.getFullYear()

    let current = new Date(startTime)
    while (times.length < 3 && current.getFullYear() <= baseYear) {
      const domMatch = days.has(current.getDate())
      const dowMatch = dows.has(current.getDay())
      const dayMatch = bothDaysRestricted ? domMatch || dowMatch : domMatch && dowMatch
      if (
        minutes.has(current.getMinutes()) &&
        hours.has(current.getHours()) &&
        dayMatch &&
        months.has(current.getMonth() + 1)
      ) {
        times.push(new Date(current))
      }
      current = new Date(current.getTime() + 60000) // Add 1 minute
    }

    return times.length > 0 ? times : null
  } catch {
    return null
  }
}

/**
 * Parse a cron field and return a Set of valid values.
 * Supports: numbers, ranges (a-b), steps (a-slash-b, star-slash-b), lists (a,b,c), and wildcards (star)
 */
function parseField(field: string, min: number, max: number): Set<number> | null {
  if (field === '*') {
    return new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i))
  }

  const result = new Set<number>()

  for (const part of field.split(',')) {
    const trimmed = part.trim()

    // Handle step values: *-slash-5, 1-30-slash-5, 0-23-slash-2
    const stepMatch = trimmed.match(/^(.+?)\/(\d+)$/)
    if (stepMatch) {
      const [, rangePart, stepStr] = stepMatch
      const step = parseInt(stepStr, 10)
      if (isNaN(step) || step <= 0) return null

      // Resolve the stepped range: `*` → whole field, `a-b` → that range,
      // bare `a` → a..max (vixie semantics). Step from the range START only.
      let start: number
      let end: number
      if (rangePart === '*') {
        start = min
        end = max
      } else if (rangePart.includes('-')) {
        const [s, e] = rangePart.split('-').map((n) => parseInt(n, 10))
        if (isNaN(s) || isNaN(e) || s > e || s < min || e > max) return null
        start = s
        end = e
      } else {
        const s = parseInt(rangePart, 10)
        if (isNaN(s) || s < min || s > max) return null
        start = s
        end = max
      }
      for (let i = start; i <= end; i += step) {
        result.add(i)
      }
      continue
    }

    // Handle ranges: 1-5, 9-17
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end) || start > end || start < min || end > max) {
        return null
      }

      for (let i = start; i <= end; i++) {
        result.add(i)
      }
      continue
    }

    // Handle single values
    const val = parseInt(trimmed, 10)
    if (isNaN(val) || val < min || val > max) return null
    result.add(val)
  }

  return result.size > 0 ? result : null
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
