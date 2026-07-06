import {
  formatTemplateDue,
  severityTemplateLabel,
  trafficTemplateLabel,
} from '#/components/Cases/caseTemplates'
import { describe, expect, test } from 'vitest'

describe('case template data helpers', () => {
  test('formats template task due offsets as compact SLA chips', () => {
    expect(formatTemplateDue(2)).toBe('+2h')
    expect(formatTemplateDue(8)).toBe('+8h')
    expect(formatTemplateDue(24)).toBe('+1d')
    expect(formatTemplateDue(48)).toBe('+2d')
  })

  test('formats severity and traffic labels for template chips', () => {
    expect(severityTemplateLabel(3)).toBe('HIGH')
    expect(trafficTemplateLabel(0)).toBe('WHITE')
    expect(trafficTemplateLabel(2)).toBe('AMBER')
  })
})
