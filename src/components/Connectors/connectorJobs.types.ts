export type ConnectorJobStatus = 'queued' | 'running' | 'success' | 'failure'
export type ConnectorJobVerdict = 'MALICIOUS' | 'SUSPICIOUS' | 'INFO' | 'CLEAN'
export type ConnectorJobTab =
  | 'all'
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'

/** A row in the analyzer-jobs queue, shaped for the table. `id` is the backend
 * job uuid (used for actions and the detail fetch); `ref` is the short form the
 * Job column renders. */
export type ConnectorJob = {
  id: string
  ref: string
  observableId: string
  observableType: string
  observable: string
  plugin: string
  status: ConnectorJobStatus
  cached?: boolean
  verdict?: ConnectorJobVerdict
  started?: string
  duration?: string
}

/** A verdict badge a connector attached to the observable (taxonomy). */
export type ConnectorJobTag = {
  connector: string
  namespace: string
  predicate: string
  value: string
  level: ConnectorJobVerdict
}

/** Full job record behind the report drawer. */
export type ConnectorJobDetail = {
  id: string
  observableType: string
  observable: string
  plugin: string
  version: string
  status: ConnectorJobStatus
  verdict?: ConnectorJobVerdict
  cached: boolean
  error?: string
  attempts: number
  tlp: number
  queued?: string
  started?: string
  ended?: string
  duration?: string
  tags: ConnectorJobTag[]
  report: Record<string, unknown> | null
}
