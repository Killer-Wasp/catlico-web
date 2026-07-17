import type {
  Observable,
  ObservableType,
} from '#/components/Observables/observables.types'
import {
  observableTypeIcons,
  observableTypeLabels,
} from '#/components/Observables/observables'
import { Badge, Text, Tooltip } from '@mantine/core'
import type { ReactNode } from 'react'

export function TypeIcon({ type }: { type: ObservableType }) {
  const Icon = observableTypeIcons[type]
  return (
    <Tooltip label={observableTypeLabels[type]} withArrow openDelay={200}>
      <Icon
        size={14}
        strokeWidth={2}
        aria-label={observableTypeLabels[type]}
        style={{
          display: 'block',
          flexShrink: 0,
          color: 'var(--mantine-color-dimmed)',
        }}
      />
    </Tooltip>
  )
}

export function TypePill({ type }: { type: ObservableType }) {
  return (
    <Badge
      variant="light"
      color="gray"
      radius="sm"
      tt="lowercase"
      ff="monospace"
      fz={11}
    >
      {type}
    </Badge>
  )
}

export function AnalysisPill({ observable }: { observable: Observable }) {
  if (!observable.analysis) {
    return (
      <Text component="span" c="dimmed" ff="monospace" fz={13}>
        —
      </Text>
    )
  }

  return (
    <Badge variant="light" color="violet" radius="sm" ff="monospace" fz={11}>
      {observable.analysis.analyzer} {observable.analysis.verdict}
    </Badge>
  )
}

export function DetailChip({
  children,
  color = 'gray',
}: {
  children: ReactNode
  color?: string
}) {
  return (
    <Badge variant="light" color={color} radius="sm" ff="monospace" fz={11}>
      {children}
    </Badge>
  )
}
