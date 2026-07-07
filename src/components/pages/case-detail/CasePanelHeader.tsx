import { Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import styles from './styles.module.css'

export function CasePanelHeader({
  action,
  label,
}: {
  action?: ReactNode
  label: string
}) {
  return (
    <Group justify="space-between" align="center">
      <Text className={styles.fieldLabel}>{label}</Text>
      {action}
    </Group>
  )
}
