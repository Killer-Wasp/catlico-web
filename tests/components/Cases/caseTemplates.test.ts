import {
  buildCustomFieldsForTemplate,
  caseTemplatesList,
  filterCaseTemplates,
  formatTemplateDue,
  getCaseTemplateStats,
  severityTemplateLabel,
  trafficTemplateLabel,
} from './caseTemplatesData'
import { describe, expect, test } from 'vitest'

describe('case template data helpers', () => {
  test('keeps the generic investigation template aligned with the prototype', () => {
    const generic = caseTemplatesList.find((template) => template.id === 'generic')

    expect(generic?.name).toBe('Generic investigation')
    expect(generic?.sev).toBe(2)
    expect(generic?.tlp).toBe(2)
    expect(generic?.pap).toBe(2)
    expect(generic?.tasks.map((task) => task.title)).toEqual([
      'Initial triage and scoping',
      'Collect and preserve evidence',
      'Document findings',
      'Close-out review',
    ])
  })

  test('merges template custom fields with mandatory organisation fields', () => {
    expect(buildCustomFieldsForTemplate('generic')).toEqual([
      {
        key: 'data_classification',
        label: 'Data classification',
        type: 'string',
        defaultValue: '',
        mandatory: true,
      },
    ])

    expect(
      buildCustomFieldsForTemplate('phishing').map((field) => field.label),
    ).toEqual(['Affected users', 'Campaign ID', 'Data classification'])
  })

  test('formats template task due offsets as compact SLA chips', () => {
    expect(formatTemplateDue(2)).toBe('+2h')
    expect(formatTemplateDue(8)).toBe('+8h')
    expect(formatTemplateDue(24)).toBe('+1d')
    expect(formatTemplateDue(48)).toBe('+2d')
  })

  test('filters templates by management tab', () => {
    expect(filterCaseTemplates(caseTemplatesList, 'all')).toHaveLength(5)
    expect(filterCaseTemplates(caseTemplatesList, 'builtin')).toHaveLength(5)
    expect(filterCaseTemplates(caseTemplatesList, 'custom')).toHaveLength(0)
  })

  test('summarises cards with flags and custom fields', () => {
    const phishing = caseTemplatesList.find(
      (template) => template.id === 'phishing',
    )

    expect(phishing ? getCaseTemplateStats(phishing) : undefined).toEqual({
      tasks: 6,
      flagged: 2,
      customFields: 2,
    })
  })

  test('formats severity and traffic labels for template chips', () => {
    expect(severityTemplateLabel(3)).toBe('HIGH')
    expect(trafficTemplateLabel(0)).toBe('WHITE')
    expect(trafficTemplateLabel(2)).toBe('AMBER')
  })
})
