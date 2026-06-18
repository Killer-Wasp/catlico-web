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
  added: string
}
