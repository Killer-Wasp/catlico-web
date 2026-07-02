import { Select } from '@mantine/core'

export function TemplateSelect<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <Select
      label={label}
      data={options}
      value={String(value)}
      onChange={(newValue) => {
        if (newValue) onChange(Number(newValue) as T)
      }}
      allowDeselect={false}
      comboboxProps={{ withinPortal: false }}
    />
  )
}
