import type { Tlp } from '#/components/Cases/casesData'

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

export const observableTypeLabels: Record<ObservableType, string> = {
  domain: 'Domain',
  url: 'Url',
  mail: 'Mail',
  ip: 'Ip',
  other: 'Other',
  hash: 'Hash',
  file: 'File',
}

export const initialObservables: Observable[] = [
  {
    id: 'obs-1',
    type: 'domain',
    value: 'login-originenergy.support',
    flags: ['ioc', 'sighted'],
    tlp: 2,
    source: '#1842',
    analysis: { analyzer: 'VT', verdict: '12/93' },
    added: '09:18',
  },
  {
    id: 'obs-2',
    type: 'url',
    value: 'hxxps://cdn-au-billing[.]net/invoice.php',
    flags: ['ioc'],
    tlp: 2,
    source: '#1842',
    analysis: { analyzer: 'URLscan', verdict: '✓' },
    added: '09:21',
  },
  {
    id: 'obs-3',
    type: 'mail',
    value: 'accounts@billing-origin.co',
    flags: ['ioc', 'sighted'],
    tlp: 2,
    source: '#1842',
    added: '09:24',
  },
  {
    id: 'obs-4',
    type: 'ip',
    value: '203.0.113.47',
    flags: ['ioc', 'sighted'],
    tlp: 2,
    source: '#1842',
    analysis: { analyzer: 'AbuseIPDB', verdict: '97%' },
    added: '09:30',
  },
  {
    id: 'obs-5',
    type: 'other',
    value: 'app_id 7f3c…91ab',
    flags: [],
    tlp: 2,
    source: '#1842',
    added: '09:33',
  },
  {
    id: 'obs-6',
    type: 'hash',
    value: 'e3b0c44298fc1c149afbf4c8996fb924…',
    flags: ['ioc'],
    tlp: 1,
    source: 'feed',
    added: '21m',
  },
  {
    id: 'obs-7',
    type: 'ip',
    value: '198.51.100.22',
    flags: ['ioc'],
    tlp: 1,
    source: '#1841',
    analysis: { analyzer: 'GreyNoise', verdict: 'noise' },
    added: '24m',
  },
  {
    id: 'obs-8',
    type: 'file',
    value: 'invoice_872144.pdf',
    flags: [],
    tlp: 2,
    source: '#1842',
    added: '31m',
  },
]
