import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { Tag } from '#/components/Tag/Tag'
import {
  CheckIcon,
  Combobox,
  Group,
  PillsInput,
  useCombobox,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

export function TemplateTagsInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const { data: templatesResult } = useQuery(caseTemplatesQueryOptions())
  // Suggest the distinct tags already in use across the org's templates.
  const tagSuggestions = useMemo(
    () =>
      [
        ...new Set(
          (templatesResult?.templates ?? []).flatMap(
            (template) => template.tags,
          ),
        ),
      ].sort(),
    [templatesResult],
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
          label="Default tags"
          description="pick a suggested tag or type your own (MITRE T-codes auto-style)"
          onClick={() => combobox.openDropdown()}
        >
          <Group gap={6}>
            {value.map((tag) => (
              <Tag key={tag} label={tag} onRemove={() => removeTag(tag)} />
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={value.length === 0 ? 'e.g. phishing, T1566' : ''}
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
