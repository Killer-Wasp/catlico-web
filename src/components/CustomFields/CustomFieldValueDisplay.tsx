import type { CustomFieldType } from '#/components/Cases/caseTemplates.types'
import { Anchor, Text } from '@mantine/core'
import { Check, X } from 'lucide-react'

/**
 * Read-only, type-aware renderer for a stored custom-field value. Pairs with
 * `CustomFieldInput`. URLs linkify, dates format to a locale date, booleans show
 * a check/cross; everything else renders as plain text. `value` is the raw value
 * as it comes back from the API (already typed by field kind).
 */
export function CustomFieldValueDisplay({
  type,
  value,
}: {
  type: CustomFieldType
  value: unknown
}) {
  if (value == null || value === '') {
    return (
      <Text component="span" c="dimmed">
        —
      </Text>
    )
  }

  if (type === 'boolean') {
    const truthy = value === true || value === 'yes' || value === 'true'
    return truthy ? (
      <Check size={16} aria-label="yes" color="var(--mantine-color-teal-6)" />
    ) : (
      <X size={16} aria-label="no" color="var(--mantine-color-red-6)" />
    )
  }

  if (type === 'url') {
    const href = String(value)
    return (
      <Anchor href={href} target="_blank" rel="noreferrer" fz={14}>
        {href}
      </Anchor>
    )
  }

  if (type === 'date') {
    const parsed = new Date(String(value))
    const text = Number.isNaN(parsed.getTime())
      ? String(value)
      : parsed.toLocaleDateString()
    return <Text component="span">{text}</Text>
  }

  return <Text component="span">{String(value)}</Text>
}
