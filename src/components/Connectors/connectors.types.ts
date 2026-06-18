export type ConnectorKind = 'analyzer' | 'responder'
export type ConnectorTab = 'all' | 'analyzers' | 'responders' | 'disabled'
export type TlpLevel = 'GREEN' | 'AMBER' | 'RED'

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
}
