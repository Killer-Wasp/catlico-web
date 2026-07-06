import type { Pap, Severity, Tlp } from '#/lib/domain'

export function formatTemplateDue(hours: number) {
  return hours < 24 ? `+${hours}h` : `+${Math.round(hours / 24)}d`
}

const severityLabels: Record<Severity, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
}

const trafficLabels: Record<Tlp | Pap, string> = {
  0: 'WHITE',
  1: 'GREEN',
  2: 'AMBER',
  3: 'RED',
}

export function severityTemplateLabel(severity: Severity) {
  return severityLabels[severity]
}

export function trafficTemplateLabel(value: Tlp | Pap) {
  return trafficLabels[value]
}
