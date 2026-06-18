export type ConnectorJobStatus = 'queued' | 'running' | 'success' | 'failure'
export type ConnectorJobVerdict = 'MALICIOUS' | 'SUSPICIOUS' | 'INFO' | 'CLEAN'
export type ConnectorJobObservableType =
  | 'ip'
  | 'domain'
  | 'url'
  | 'hash'
  | 'mail'
export type ConnectorJobTab =
  | 'all'
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'

export type ConnectorJob = {
  id: string
  observableType: ConnectorJobObservableType
  observable: string
  plugin: string
  status: ConnectorJobStatus
  cached?: boolean
  verdict?: ConnectorJobVerdict
  started?: string
  duration?: string
}

export type ConnectorJobReportChip = {
  label: string
  color?: string
}

export type ConnectorJobReportArtifact = {
  type: ConnectorJobObservableType
  value: string
}

export type ConnectorJobReportOperation = {
  action: string
  argument?: string
}

export type ConnectorJobReportEnrichment = {
  id: string
  verdict: ConnectorJobVerdict
  analyzer: string
  meta: string
  chips: ConnectorJobReportChip[]
  artifacts?: ConnectorJobReportArtifact[]
  operations?: ConnectorJobReportOperation[]
}

export type ConnectorJobReportCase = {
  id: string
  title: string
  status: string
}

export type ConnectorJobReport = {
  jobId: string
  observableType: ConnectorJobObservableType
  observable: string
  verdict: ConnectorJobVerdict
  properties: {
    ioc: boolean
    sighted: boolean
    firstSeen: string
    source: string
  }
  enrichments: ConnectorJobReportEnrichment[]
  seenInCases: ConnectorJobReportCase[]
}
