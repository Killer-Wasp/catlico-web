import { Combobox, Pill, PillsInput, useCombobox } from '@mantine/core'
import { useMemo, useState } from 'react'
import classes from './TokenSearch.module.css'

// AWS EC2-style token search. The user picks a field, then a value, and each
// choice is committed as a `field:value` pill. Multiple pills build a compound
// filter. The component owns only the combobox UX — it is table-agnostic and
// reports its state through the controlled `tokens` / `onChange` props.

export type TokenFieldKind = 'enum' | 'text'

export type TokenField = {
  /** Stable key used in tokens and option encoding (e.g. "status"). */
  key: string
  /** Display label shown in the field list and pill prefix. */
  label: string
  kind: TokenFieldKind
  /** Required for `enum` fields; the selectable values. */
  options?: { value: string; label: string }[]
}

export type Token = { field: string; value: string; label: string }

export type TokenSearchProps = {
  fields: TokenField[]
  tokens: Token[]
  onChange: (tokens: Token[]) => void
  placeholder?: string
}

// Resolve a typed field name to a field: exact key/label match, or a unique
// prefix match. Used by the ":" shortcut to jump straight into value stage.
function matchField(fields: TokenField[], search: string): TokenField | null {
  const s = search.trim().toLowerCase()
  if (!s) return null
  const exact = fields.find(
    (f) => f.key.toLowerCase() === s || f.label.toLowerCase() === s,
  )
  if (exact) return exact
  const prefix = fields.filter((f) => f.key.toLowerCase().startsWith(s))
  return prefix.length === 1 ? prefix[0] : null
}

export function TokenSearch({
  fields,
  tokens,
  onChange,
  placeholder = 'Filter cases — pick a field, then a value',
}: TokenSearchProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  })

  const [search, setSearch] = useState('')
  // The field currently being valued; null means we're choosing a field.
  const [activeField, setActiveField] = useState<TokenField | null>(null)

  const fieldByKey = useMemo(
    () => new Map(fields.map((f) => [f.key, f])),
    [fields],
  )

  const options = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!activeField) {
      return fields
        .filter(
          (f) =>
            !s ||
            f.label.toLowerCase().includes(s) ||
            f.key.toLowerCase().includes(s),
        )
        .map((f) => ({ value: `field:${f.key}`, label: f.label }))
    }
    if (activeField.kind === 'enum') {
      const used = new Set(
        tokens.filter((t) => t.field === activeField.key).map((t) => t.value),
      )
      return (activeField.options ?? [])
        .filter(
          (o) =>
            !used.has(o.value) && (!s || o.label.toLowerCase().includes(s)),
        )
        .map((o) => ({ value: `val:${o.value}`, label: o.label }))
    }
    return []
  }, [activeField, fields, search, tokens])

  const commit = (field: TokenField, value: string, label: string) => {
    // Ignore exact duplicates within the same field.
    if (tokens.some((t) => t.field === field.key && t.value === value)) return
    onChange([...tokens, { field: field.key, value, label }])
    setActiveField(null)
    setSearch('')
  }

  const handleOptionSubmit = (optionValue: string) => {
    if (optionValue.startsWith('field:')) {
      const field = fieldByKey.get(optionValue.slice('field:'.length))
      if (field) {
        setActiveField(field)
        setSearch('')
      }
      return
    }
    if (optionValue.startsWith('val:') && activeField) {
      const value = optionValue.slice('val:'.length)
      const opt = activeField.options?.find((o) => o.value === value)
      commit(activeField, value, opt?.label ?? value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ':' && !activeField) {
      const field = matchField(fields, search)
      if (field) {
        e.preventDefault()
        setActiveField(field)
        setSearch('')
      }
      return
    }
    if (e.key === 'Enter' && activeField?.kind === 'text' && search.trim()) {
      e.preventDefault()
      const v = search.trim()
      commit(activeField, v, v)
      return
    }
    if (e.key === 'Backspace' && search === '') {
      if (activeField) setActiveField(null)
      else if (tokens.length) onChange(tokens.slice(0, -1))
      return
    }
    if (e.key === 'Escape') {
      if (activeField) {
        setActiveField(null)
        setSearch('')
      }
      combobox.closeDropdown()
    }
  }

  const removeToken = (index: number) =>
    onChange(tokens.filter((_, i) => i !== index))

  const pills = tokens.map((t, i) => {
    const field = fieldByKey.get(t.field)
    return (
      <Pill
        key={`${t.field}:${t.value}`}
        withRemoveButton
        onRemove={() => removeToken(i)}
      >
        {field?.label ?? t.field}:{t.label}
      </Pill>
    )
  })

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleOptionSubmit}
      withinPortal={false}
      size="xs"
    >
      <Combobox.DropdownTarget>
        <PillsInput
          size="xs"
          className={classes.input}
          onClick={() => combobox.openDropdown()}
        >
          <Pill.Group>
            {pills}
            {activeField && (
              <Pill
                withRemoveButton
                className={classes.activePill}
                onRemove={() => {
                  setActiveField(null)
                  setSearch('')
                }}
              >
                {activeField.label}:
              </Pill>
            )}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={
                  activeField
                    ? activeField.kind === 'text'
                      ? `type a ${activeField.label}…`
                      : `select a ${activeField.label}…`
                    : tokens.length
                      ? undefined
                      : placeholder
                }
                onChange={(e) => {
                  setSearch(e.currentTarget.value)
                  combobox.openDropdown()
                  combobox.updateSelectedOptionIndex()
                }}
                onFocus={() => combobox.openDropdown()}
                onKeyDown={handleKeyDown}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length > 0 ? (
            options.map((o) => (
              <Combobox.Option value={o.value} key={o.value}>
                {o.label}
              </Combobox.Option>
            ))
          ) : (
            <Combobox.Empty>
              {activeField?.kind === 'text'
                ? search.trim()
                  ? 'Press Enter to add'
                  : `Type a ${activeField.label}`
                : 'No matches'}
            </Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
