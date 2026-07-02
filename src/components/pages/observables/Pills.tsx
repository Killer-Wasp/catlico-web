import type {
  Observable,
  ObservableType,
} from '#/components/Observables/observables.types'
import { TLP } from '#/lib/domain'
import { Badge, Text } from '@mantine/core'
import type { ReactNode } from 'react'

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

export function TlpPill({ tlp }: { tlp: Observable['tlp'] }) {
  const label = TLP[tlp].toUpperCase()
  const color =
    tlp === 1 ? 'green' : tlp === 2 ? 'yellow' : tlp === 3 ? 'red' : 'gray'
  return (
    <Badge variant="light" color={color} radius="sm" ff="monospace" fz={11}>
      TLP:{label}
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
