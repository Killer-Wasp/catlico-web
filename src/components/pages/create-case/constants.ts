export type TrafficLight = 0 | 1 | 2 | 3
export type SeverityChoice = 1 | 2 | 3 | 4

export const BUSINESS_UNITS = [
  'Corporate IT',
  'Retail',
  'Energy Markets',
  'Generation / OT',
  'Digital',
]

export const SEVERITY_CHOICES: {
  value: SeverityChoice
  label: string
  color: string
}[] = [
  { value: 1, label: 'LOW', color: 'var(--sev-low)' },
  { value: 2, label: 'MEDIUM', color: 'var(--sev-medium)' },
  { value: 3, label: 'HIGH', color: 'var(--sev-high)' },
  { value: 4, label: 'CRITICAL', color: 'var(--sev-critical)' },
]

export const TRAFFIC_CHOICES: {
  value: TrafficLight
  label: string
  color: string
}[] = [
  { value: 0, label: 'WHITE', color: 'var(--tlp-white)' },
  { value: 1, label: 'GREEN', color: 'var(--tlp-green)' },
  { value: 2, label: 'AMBER', color: 'var(--tlp-amber)' },
  { value: 3, label: 'RED', color: 'var(--tlp-red)' },
]
