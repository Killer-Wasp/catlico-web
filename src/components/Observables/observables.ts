import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  CircleHelp,
  File,
  Globe,
  Hash,
  Link,
  Network,
} from 'lucide-react'
import type { ObservableType } from './observables.types'

export const observableTypeLabels: Record<ObservableType, string> = {
  domain: 'Domain',
  url: 'Url',
  mail: 'Mail',
  ip: 'Ip',
  other: 'Other',
  hash: 'Hash',
  file: 'File',
}

export const observableTypeIcons: Record<ObservableType, LucideIcon> = {
  domain: Globe,
  url: Link,
  mail: AtSign,
  ip: Network,
  other: CircleHelp,
  hash: Hash,
  file: File,
}
