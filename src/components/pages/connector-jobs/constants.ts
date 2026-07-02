import type {
  ConnectorJobStatus,
  ConnectorJobTab,
  ConnectorJobVerdict,
} from '#/components/Connectors/connectorJobs.types'
import { connectorJobTabs } from '#/components/Connectors/connectorJobs'

export const STATUS_COLOR: Record<ConnectorJobStatus, string> = {
  queued: 'gray',
  running: 'blue',
  success: 'green',
  failure: 'red',
}

export const VERDICT_COLOR: Record<ConnectorJobVerdict, string> = {
  MALICIOUS: 'red',
  SUSPICIOUS: 'yellow',
  INFO: 'blue',
  CLEAN: 'green',
}

export function isConnectorJobTab(
  value: string | null,
): value is ConnectorJobTab {
  return connectorJobTabs.some((tab) => tab.value === value)
}

export function isTerminal(status: ConnectorJobStatus) {
  return status === 'success' || status === 'failure'
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
}
