import type { Tlp } from '#/lib/domain'

export type ObservableType =
  | 'domain'
  | 'url'
  | 'mail'
  | 'ip'
  | 'other'
  | 'hash'
  | 'file'

export type ObservableFlag = 'ioc' | 'sighted'

/**
 * A downloadable file backing a file observable. A non-null `attachment` is the
 * sole signal that the observable has a file (fetched from
 * `GET /observables/{id}/file`); string observables carry `null`.
 */
export type ObservableAttachment = {
  filename: string
  size: number
  content_type: string
}

export type ObservableAnalysis = {
  analyzer: string
  verdict: string
}

export type Observable = {
  id: string
  type: ObservableType
  value: string
  flags: ObservableFlag[]
  tlp: Tlp
  source: string
  analysis?: ObservableAnalysis
  attachment: ObservableAttachment | null
  added: string
  addedAt: string
}
