import { Button, Group, Stack, Text } from '@mantine/core'
import styles from './styles.module.css'

export function RequiredMark() {
  return (
    <Text component="span" c="var(--sev-critical)" inherit>
      {' '}
      *
    </Text>
  )
}

export function FieldLabel({
  children,
  required,
}: {
  children: string
  required?: boolean
}) {
  return (
    <Text component="span" className={styles.fieldLabel}>
      {children}
      {required && <RequiredMark />}
    </Text>
  )
}

function choiceStyle(active: boolean, color: string) {
  return active
    ? {
        color,
        borderColor: color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }
    : undefined
}

export function SegmentedButtons<T extends number>({
  label,
  choices,
  value,
  onChange,
  required,
  isDisabled,
}: {
  label: string
  choices: { value: T; label: string; color: string }[]
  value: T
  onChange: (value: T) => void
  required?: boolean
  /**
   * Optionally disable individual choices — e.g. a restrictiveness floor where
   * values below the floor can't be selected (case merge's TLP/PAP guard).
   */
  isDisabled?: (value: T) => boolean
}) {
  return (
    <Stack gap={6}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Group gap={6} role="radiogroup" aria-label={label}>
        {choices.map((choice) => {
          const active = choice.value === value
          return (
            <Button
              key={choice.value}
              type="button"
              size="xs"
              variant="default"
              role="radio"
              aria-checked={active}
              disabled={isDisabled?.(choice.value)}
              onClick={() => onChange(choice.value)}
              ff="monospace"
              fz={11}
              lts="0.4px"
              fw={700}
              style={choiceStyle(active, choice.color)}
            >
              {choice.label}
            </Button>
          )
        })}
      </Group>
    </Stack>
  )
}
