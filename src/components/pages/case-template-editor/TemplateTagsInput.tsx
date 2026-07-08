import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { TagPickerInput } from '#/components/Tag/TagPickerInput'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

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
  return (
    <TagPickerInput
      label="Default tags"
      description="pick a suggested tag or type your own (MITRE T-codes auto-style)"
      placeholder="e.g. phishing, T1566"
      suggestions={tagSuggestions}
      value={value}
      onChange={onChange}
    />
  )
}
