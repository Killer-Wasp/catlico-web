import type { Severity, Tlp } from '#/lib/domain'

// Alert as the triage queue consumes it — the same shape TheHive's `listAlert`
// query returns, trimmed to what the list view needs.
export type Alert = {
  id: string
  sev: Severity
  tlp: Tlp
  title: string
  /** Detection source / connector that raised the alert. */
  src: string
  tags: string[]
  /** Age of the alert in minutes — drives the "14m" / "1.5h" stamp. */
  ageMin: number
  /** Backend alert date, used for human relative timestamps in detail views. */
  firstSeenAt?: string
  /** True once the alert has blown its triage SLA. */
  breach: boolean
  description: string
  observables: AlertObservable[]
  similarCases: AlertSimilarCase[]
}

export type AlertObservable = {
  type: string
  value: string
}

export type AlertSimilarCase = {
  id: string
  title: string
  sev: Severity
  status: string
}
