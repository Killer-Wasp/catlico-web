import { Box, Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import styles from './styles.module.css'

export function CaseDrawerSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Box px={22} py={16} style={{ borderTop: '1px solid var(--line-soft)' }}>
      <Group mb={10} gap="xs" wrap="nowrap">
        <Text component="h3" className={styles.fieldLabel} m={0}>
          {title}
        </Text>
        {action ? <Group ml="auto">{action}</Group> : null}
      </Group>
      {children}
    </Box>
  )
}
