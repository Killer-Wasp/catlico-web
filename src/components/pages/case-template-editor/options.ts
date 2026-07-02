import type { CustomFieldType } from '#/components/Cases/caseTemplates.types'

export const severityOptions = [
  { value: '1', label: 'LOW' },
  { value: '2', label: 'MEDIUM' },
  { value: '3', label: 'HIGH' },
  { value: '4', label: 'CRITICAL' },
]

export const trafficOptions = [
  { value: '0', label: 'WHITE' },
  { value: '1', label: 'GREEN' },
  { value: '2', label: 'AMBER' },
  { value: '3', label: 'RED' },
]

export const assigneeOptions = [
  { value: '', label: 'Unassigned' },
  { value: 'J. Tanaka', label: 'J. Tanaka' },
  { value: 'P. Nguyen', label: 'P. Nguyen' },
  { value: 'A. Whitford', label: 'A. Whitford' },
  { value: 'S. Iyer', label: 'S. Iyer' },
]

export const customFieldTypes: CustomFieldType[] = [
  'string',
  'integer',
  'float',
  'boolean',
  'date',
]
