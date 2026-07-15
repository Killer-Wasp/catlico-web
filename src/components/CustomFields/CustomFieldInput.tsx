import type { CustomFieldType } from '#/components/Cases/caseTemplates.types'
import { FieldLabel } from '#/components/pages/create-case/Fields'
import { NumberInput, Select, TextInput } from '@mantine/core'

/** True when `value` parses as an http/https URL (empty is treated as valid — the
 *  mandatory check owns "required"). Exported so callers can gate submit. */
export function isValidUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Type-aware editor for a single custom-field value. The value is carried as a
 * string in the form (parents convert to the typed payload at submit); `options`,
 * when non-empty, turns any field into a constrained dropdown. Pairs with
 * `CustomFieldValueDisplay` for the read-only side.
 */
export function CustomFieldInput({
  type,
  options,
  label,
  value,
  error,
  onChange,
  mandatory,
}: {
  type: CustomFieldType
  /** Allowed values (a dropdown). Backend only allows these on string fields. */
  options?: string[]
  label: string
  value: string
  error?: boolean
  onChange: (value: string) => void
  mandatory?: boolean
}) {
  const urlError = type === 'url' && !isValidUrl(value)
  const errorText = error
    ? 'Required'
    : urlError
      ? 'Enter an http/https URL'
      : undefined
  const inputProps = {
    label: <FieldLabel required={mandatory}>{label}</FieldLabel>,
    error: errorText,
  }

  if (options && options.length > 0) {
    return (
      <Select
        {...inputProps}
        placeholder="—"
        data={options}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        searchable
      />
    )
  }

  if (type === 'integer' || type === 'float') {
    return (
      <NumberInput
        {...inputProps}
        placeholder={type}
        value={value === '' ? undefined : Number(value)}
        allowDecimal={type === 'float'}
        onChange={(next) => onChange(next === '' ? '' : String(next))}
      />
    )
  }

  if (type === 'boolean') {
    return (
      <Select
        {...inputProps}
        placeholder="—"
        data={['yes', 'no']}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
      />
    )
  }

  return (
    <TextInput
      {...inputProps}
      type={type === 'date' ? 'date' : type === 'url' ? 'url' : 'text'}
      placeholder={type}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}
