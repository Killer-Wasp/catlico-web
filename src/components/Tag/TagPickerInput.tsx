import { Tag } from '#/components/Tag/Tag'
import {
  CheckIcon,
  Combobox,
  Group,
  PillsInput,
  useCombobox,
} from '@mantine/core'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

type TagPickerInputProps = {
  label: ReactNode
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  description?: ReactNode
  placeholder?: string
}

export function TagPickerInput({
  label,
  value,
  onChange,
  suggestions = [],
  description,
  placeholder,
}: TagPickerInputProps) {
  const tagSuggestions = useMemo(
    () => [...new Set(suggestions)].sort(),
    [suggestions],
  )
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
  })
  const [search, setSearch] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
  }

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag))

  const toggleTag = (tag: string) =>
    value.includes(tag) ? removeTag(tag) : addTag(tag)

  const trimmed = search.trim()
  const filtered = tagSuggestions.filter((tag) =>
    tag.toLowerCase().includes(trimmed.toLowerCase()),
  )
  const canCreate = trimmed.length > 0 && !tagSuggestions.includes(trimmed)

  const options = filtered.map((tag) => (
    <Combobox.Option value={tag} key={tag} active={value.includes(tag)}>
      <Group gap="sm">
        {value.includes(tag) ? <CheckIcon size={12} /> : null}
        <span>{tag}</span>
      </Group>
    </Combobox.Option>
  ))

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '$create') {
          addTag(trimmed)
        } else {
          toggleTag(val)
        }
        setSearch('')
      }}
    >
      <Combobox.DropdownTarget>
        <PillsInput
          label={label}
          description={description}
          onClick={() => combobox.openDropdown()}
        >
          <Group gap={6}>
            {value.map((tag) => (
              <Tag key={tag} label={tag} onRemove={() => removeTag(tag)} />
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={value.length === 0 ? placeholder : ''}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => {
                  combobox.closeDropdown()
                  if (search.trim()) {
                    addTag(search)
                    setSearch('')
                  }
                }}
                onChange={(event) => {
                  combobox.openDropdown()
                  combobox.updateSelectedOptionIndex()
                  setSearch(event.currentTarget.value)
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Backspace' &&
                    search.length === 0 &&
                    value.length > 0
                  ) {
                    event.preventDefault()
                    removeTag(value[value.length - 1])
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options}
          {canCreate ? (
            <Combobox.Option value="$create">
              + Create "{trimmed}"
            </Combobox.Option>
          ) : null}
          {options.length === 0 && !canCreate ? (
            <Combobox.Empty>Nothing found</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
