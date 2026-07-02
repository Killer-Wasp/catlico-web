import type {
  ConnectorKind,
  ConnectorTab,
  TlpLevel,
} from '#/components/Connectors/connectors.types'
import { useEffect, useState } from 'react'

export const TAB_OPTIONS: { value: ConnectorTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'analyzers', label: 'Analyzers' },
  { value: 'responders', label: 'Responders' },
  { value: 'disabled', label: 'Disabled' },
]

export const KIND_COLOR: Record<ConnectorKind, string> = {
  analyzer: 'violet',
  responder: 'orange',
}

export const TLP_LEVEL_COLOR: Record<TlpLevel, string> = {
  GREEN: 'green',
  AMBER: 'yellow',
  RED: 'red',
}

export function isConnectorTab(value: string | null): value is ConnectorTab {
  return TAB_OPTIONS.some((tab) => tab.value === value)
}

export function useStamp() {
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Australia/Brisbane',
    })
    const time = now
      .toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Brisbane',
      })
      .toLowerCase()
    setStamp(`${date}, ${time} AEST`)
  }, [])
  return stamp
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
}
