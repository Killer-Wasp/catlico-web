import { Combobox, Pill, PillsInput, Text, useCombobox } from '@mantine/core'
import { useMemo, useState } from 'react'
import { Tag } from '#/components/Tag/Tag'
import classes from './TokenSearch.module.css'

// AWS EC2-style token search. The user picks a field, optionally an operator,
// then a value, and each choice is committed as a pill. Multiple pills build a
// compound filter. The component owns only the combobox UX — it is table-agnostic
// and reports its state through the controlled `tokens` / `onChange` props.
//
// Operators are opt-in per field. A field with no `operators` keeps the legacy
// behaviour: no operator stage, and a `field:value` pill. A field that declares
// `operators` renders EC2-style `field = value` / `field : value` pills and, when
// it offers more than one, an operator-selection stage between field and value.

export type TokenFieldKind = 'enum' | 'text'
export type TokenOp = 'eq' | 'co'

export type TokenField = {
  /** Stable key used in tokens and option encoding (e.g. "status"). */
  key: string
  /** Display label shown in the field list and pill prefix. */
  label: string
  kind: TokenFieldKind
  /** Required for `enum` fields; the selectable values. */
  options?: { value: string; label: string }[]
  /** Operators this field offers. Omit for the legacy single-operator behaviour. */
  operators?: TokenOp[]
}

export type Token = {
  field: string
  value: string
  label: string
  op?: TokenOp
}

export type TokenSearchProps = {
  fields: TokenField[]
  tokens: Token[]
  onChange: (tokens: Token[]) => void
  placeholder?: string
  /**
   * Key of a `text` field that free-typed text falls back to when no field has
   * been picked. Typing a term and pressing Enter (when it matches no field)
   * commits a token on this field, so the bar doubles as a plain search box.
   */
  defaultTextField?: string
}

const OP_SYMBOL: Record<TokenOp, string> = { eq: '=', co: ':' }
const OP_LABEL: Record<TokenOp, string> = { eq: 'Equals', co: 'Contains' }

// A field opts into EC2-style operator pills by declaring `operators`.
const usesOperators = (f: TokenField) => f.operators != null
// Whether the operator-selection stage is shown (more than one to choose from).
const needsOpStage = (f: TokenField) => (f.operators?.length ?? 0) > 1
const defaultOp = (f: TokenField): TokenOp => f.operators?.[0] ?? 'eq'

// Resolve a typed field name to a field: exact key/label match, or a unique
// prefix match. Used by the ":" shortcut to jump straight past field selection.
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
  defaultTextField,
}: TokenSearchProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  })

  const [search, setSearch] = useState('')
  // The field currently being valued; null means we're choosing a field.
  const [activeField, setActiveField] = useState<TokenField | null>(null)
  // The chosen operator; null while still on the operator stage.
  const [activeOp, setActiveOp] = useState<TokenOp | null>(null)

  const fieldByKey = useMemo(
    () => new Map(fields.map((f) => [f.key, f])),
    [fields],
  )

  // The text field free-typed input falls back to (the bar's "search box" mode).
  const defaultField = useMemo(
    () =>
      defaultTextField
        ? fields.find((f) => f.key === defaultTextField && f.kind === 'text')
        : undefined,
    [defaultTextField, fields],
  )

  // A search box is a "contains" match: prefer the `co` operator when the field
  // offers it, whatever its declared order (else let commit pick the default).
  const searchOp = (f: TokenField): TokenOp | undefined =>
    f.operators?.includes('co') ? 'co' : undefined

  // Phase: 'field' → 'op' (only when needed) → 'value'.
  const phase: 'field' | 'op' | 'value' = !activeField
    ? 'field'
    : needsOpStage(activeField) && activeOp === null
      ? 'op'
      : 'value'

  // Fields matching the current search, shown while choosing a field.
  const fieldMatches = useMemo(() => {
    const s = search.trim().toLowerCase()
    return fields.filter(
      (f) =>
        !s ||
        f.label.toLowerCase().includes(s) ||
        f.key.toLowerCase().includes(s),
    )
  }, [fields, search])

  const options = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (phase === 'field') {
      const opts = fieldMatches.map((f) => ({
        value: `field:${f.key}`,
        label: f.label,
      }))
      // Offer a free-text search on the default field as a trailing option, so
      // a field match still wins the default highlight but plain search is one
      // click (or, when nothing matches, the only option) away.
      if (defaultField && s) {
        opts.push({
          value: `search:${search.trim()}`,
          label: `Search ${defaultField.label} for “${search.trim()}”`,
        })
      }
      return opts
    }
    if (phase === 'op' && activeField) {
      return (activeField.operators ?? []).map((op) => ({
        value: `op:${op}`,
        label: `${activeField.label} ${OP_SYMBOL[op]} — ${OP_LABEL[op]}`,
      }))
    }
    // value phase, enum: offer the not-yet-used values.
    if (activeField?.kind === 'enum') {
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
  }, [phase, activeField, activeOp, fields, search, tokens, fieldMatches, defaultField])

  const commit = (
    field: TokenField,
    value: string,
    label: string,
    opOverride?: TokenOp,
  ) => {
    const op = usesOperators(field)
      ? (opOverride ?? activeOp ?? defaultOp(field))
      : undefined
    // Ignore exact duplicates within the same field + operator.
    if (
      tokens.some(
        (t) => t.field === field.key && t.value === value && t.op === op,
      )
    ) {
      resetToFieldStage()
      return
    }
    onChange([...tokens, { field: field.key, value, label, op }])
    resetToFieldStage()
  }

  const resetToFieldStage = () => {
    setActiveField(null)
    setActiveOp(null)
    setSearch('')
  }

  const enterField = (field: TokenField) => {
    setActiveField(field)
    setActiveOp(needsOpStage(field) ? null : defaultOp(field))
    setSearch('')
  }

  const handleOptionSubmit = (optionValue: string) => {
    if (optionValue.startsWith('field:')) {
      const field = fieldByKey.get(optionValue.slice('field:'.length))
      if (field) enterField(field)
      return
    }
    if (optionValue.startsWith('search:') && defaultField) {
      const v = optionValue.slice('search:'.length)
      commit(defaultField, v, v, searchOp(defaultField))
      return
    }
    if (optionValue.startsWith('op:') && activeField) {
      setActiveOp(optionValue.slice('op:'.length) as TokenOp)
      setSearch('')
      return
    }
    if (optionValue.startsWith('val:') && activeField) {
      const value = optionValue.slice('val:'.length)
      const opt = activeField.options?.find((o) => o.value === value)
      commit(activeField, value, opt?.label ?? value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ':' && phase === 'field') {
      const field = matchField(fields, search)
      if (field) {
        e.preventDefault()
        enterField(field)
      }
      return
    }
    // In the field stage, Enter on a term that matches no field runs a free-text
    // search on the default field. When fields do match, we defer to the combobox
    // so Enter still selects the highlighted field.
    if (
      e.key === 'Enter' &&
      phase === 'field' &&
      defaultField &&
      search.trim() &&
      fieldMatches.length === 0
    ) {
      e.preventDefault()
      const v = search.trim()
      commit(defaultField, v, v, searchOp(defaultField))
      return
    }
    if (
      e.key === 'Enter' &&
      phase === 'value' &&
      activeField?.kind === 'text' &&
      search.trim()
    ) {
      e.preventDefault()
      const v = search.trim()
      commit(activeField, v, v)
      return
    }
    if (e.key === 'Backspace' && search === '') {
      if (phase === 'value' && activeField && needsOpStage(activeField)) {
        setActiveOp(null) // step back to operator selection
      } else if (activeField) {
        resetToFieldStage()
      } else if (tokens.length) {
        onChange(tokens.slice(0, -1))
      }
      return
    }
    if (e.key === 'Escape') {
      if (activeField) resetToFieldStage()
      combobox.closeDropdown()
    }
  }

  const removeToken = (index: number) =>
    onChange(tokens.filter((_, i) => i !== index))

  const pillLabel = (t: Token) => {
    const field = fieldByKey.get(t.field)
    const name = field?.label ?? t.field
    if (field && usesOperators(field)) {
      return `${name} ${OP_SYMBOL[t.op ?? 'eq']} ${t.label}`
    }
    return `${name}:${t.label}`
  }

  const toneForField = (
    fieldKey: string,
  ): React.ComponentProps<typeof Tag>['tone'] => {
    const key = fieldKey.toLowerCase()
    if (key === 'status') return 'status'
    if (key === 'severity') return 'severity'
    if (key === 'assignee') return 'assignee'
    if (key === 'tlp' || key === 'tag:tlp') return 'tlp'
    if (key === 'pap' || key === 'tag:pap') return 'pap'
    if (key.startsWith('tag:')) return 'taxonomy'
    return 'neutral'
  }

  const pillTone = (t: Token): React.ComponentProps<typeof Tag>['tone'] =>
    toneForField(t.field)

  const pills = tokens.map((t, i) => (
    <Tag
      key={`${t.field}:${t.op ?? ''}:${t.value}`}
      label={pillLabel(t)}
      tone={pillTone(t)}
      onRemove={() => removeToken(i)}
      removeLabel={`Remove ${pillLabel(t)} filter`}
    />
  ))

  // In-progress pill prefix while valuing a field, e.g. "Status =" or "Title".
  const activePrefix = activeField
    ? usesOperators(activeField) && activeOp
      ? `${activeField.label} ${OP_SYMBOL[activeOp]}`
      : activeField.label
    : ''

  const fieldPlaceholder = () => {
    if (phase === 'op') return `pick an operator…`
    if (phase === 'value') {
      return activeField?.kind === 'text'
        ? `type a ${activeField.label}…`
        : `select a ${activeField?.label}…`
    }
    return tokens.length ? undefined : placeholder
  }

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
              <Tag
                label={activePrefix}
                tone={toneForField(activeField.key)}
                onRemove={resetToFieldStage}
                removeLabel={`Clear ${activePrefix} filter`}
              />
            )}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={fieldPlaceholder()}
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
              {phase === 'value' && activeField?.kind === 'text' ? (
                search.trim() ? (
                  'Press Enter to add'
                ) : (
                  <Text size="xs" c="dimmed">
                    Type a {activeField.label}
                  </Text>
                )
              ) : (
                'No matches'
              )}
            </Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
