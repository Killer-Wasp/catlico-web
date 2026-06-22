export type ConnectorKind = 'analyzer' | 'responder'
export type ConnectorTab = 'all' | 'analyzers' | 'responders' | 'disabled'
export type TlpLevel = 'GREEN' | 'AMBER' | 'RED'

export type ConnectorConfigItem = {
  name: string
  description?: string
  type?: string
  required?: boolean
  defaultValue?: unknown
}

export type ConnectorManifest = {
  config?: {
    check_tlp?: boolean
    max_tlp?: number
    check_pap?: boolean
    max_pap?: number
    auto_extract?: boolean
  }
  configurationItems?: ConnectorConfigItem[]
}

export type Connector = {
  id: string
  name: string
  initials: string
  version: string
  kind: ConnectorKind
  description: string
  observables: string[]
  tlp: TlpLevel
  runs24h: number
  latency: string
  enabled: boolean
  color: string
  available: boolean
  maxRuntimeSeconds: number
  settings: Record<string, unknown>
  hasSecrets: boolean
  manifest: ConnectorManifest
  configItems: ConnectorConfigItem[]
}

export type ConnectorConfigPayload = {
  settings: Record<string, unknown>
  secrets: Record<string, unknown>
}
