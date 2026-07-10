import type { Observable } from '#/components/Observables/observables.types'
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './styles.module.css'

function sourceLabel(source: string): string {
  if (source.startsWith('#')) return `Case ${source}`
  if (source.startsWith('AL-')) return `Alert ${source.slice(3)}`
  return source
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Group gap={20} align="flex-start" wrap="nowrap">
      <Text ff="monospace" fz={12} c="dimmed" w={120}>
        {label}
      </Text>
      <Text fz={13} fw={600}>
        {children}
      </Text>
    </Group>
  )
}

export function ObservableDetailDrawer({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable | null
  onToggleIoc?: (observable: Observable) => void
  onMarkSighted?: (observable: Observable) => void
  onClose: () => void
}) {
  if (!observable) return null

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title="Observable detail"
      padding={0}
      overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}
      styles={{
        content: { borderLeft: '4px solid var(--mantine-color-red-6)' },
        header: { display: 'none' },
        body: { height: '100%', padding: 0 },
      }}
    >
      <ObservableDetailContent
        observable={observable}
        onToggleIoc={onToggleIoc}
        onMarkSighted={onMarkSighted}
        onClose={onClose}
      />
    </Drawer>
  )
}

function ObservableDetailContent({
  observable,
  onToggleIoc,
  onMarkSighted,
  onClose,
}: {
  observable: Observable
  onToggleIoc?: (observable: Observable) => void
  onMarkSighted?: (observable: Observable) => void
  onClose: () => void
}) {
  const ioc = observable.flags.includes('ioc')
  const sighted = observable.flags.includes('sighted')

  return (
    <Stack h="100%" gap={0}>
      <Box p="lg" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text ff="monospace" fz={12} fw={700} c="dimmed" tt="uppercase">
              OBSERVABLE · {observable.type}
            </Text>
            <Text ff="monospace" fz={18} fw={700} mt={8}>
              {observable.value}
            </Text>
          </Box>
          <ActionIcon
            variant="default"
            color="gray"
            aria-label="Close observable detail"
            onClick={onClose}
          >
            <X size={18} />
          </ActionIcon>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto' }}>
        <Stack gap="lg" p="lg">
          <Stack gap="xs">
            <Text className={styles.columnHeader}>Properties</Text>
            <DetailRow label="Type">{observable.type}</DetailRow>
            <DetailRow label="Value">{observable.value}</DetailRow>
            <DetailRow label="IOC">
              <Text component="span" c={ioc ? 'red.7' : 'dimmed'} fw={700}>
                {ioc ? 'yes' : 'no'}
              </Text>
            </DetailRow>
            <DetailRow label="Sighted">{sighted ? 'yes' : 'no'}</DetailRow>
            <DetailRow label="First seen">{observable.added}</DetailRow>
            <DetailRow label="Source">
              {sourceLabel(observable.source)}
            </DetailRow>
          </Stack>
        </Stack>
      </Box>

      <Group
        p="lg"
        gap="sm"
        grow
        style={{ borderTop: '1px solid var(--line-soft)' }}
      >
        {onToggleIoc ? (
          <Button variant="default" onClick={() => onToggleIoc(observable)}>
            Toggle IOC
          </Button>
        ) : null}
        {onMarkSighted ? (
          <Button
            variant="default"
            disabled={sighted}
            onClick={() => onMarkSighted(observable)}
          >
            Mark sighted
          </Button>
        ) : null}
        <Button disabled>Export to MISP</Button>
      </Group>
    </Stack>
  )
}
